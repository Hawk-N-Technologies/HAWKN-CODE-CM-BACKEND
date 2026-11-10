const { QueryTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const EmployeeBonus = require("../models/EmployeeBonus");
const logger = require("../utils/logger");

const MAX_LIST_ROWS = 500; // safety cap until the table gets pagination

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Money in whole paise — avoids floating-point rounding errors
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

// "2026-10" → "2026-10-01" (DB stores the 1st of the month)
const monthToPeriod = (yyyyMm) => `${yyyyMm}-01`;

function toResponse(row) {
  return {
    uuid: row.uuid,
    payPeriod: String(row.payPeriod).slice(0, 7), // "2026-10"
    bonusType: row.bonusType,
    amount: Number(row.amount),
    reason: row.reason,
    createdAt: row.createdAt,
    employee: {
      uuid: row.userUuid,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
    },
  };
}

// Only active, non-client users of THIS company can get a bonus
async function findPayableUser(userUuid, companyId, transaction) {
  const [user] = await sequelize.query(
    `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.uuid = :userUuid
        AND u.company_id = :companyId
        AND u.is_active = TRUE
        AND r.name <> 'client'
      LIMIT 1`,
    {
      replacements: { userUuid, companyId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  return user || null;
}

// Once that month's payroll is Processed, its bonuses are locked
async function isPayrollProcessed(companyId, userId, payPeriod, transaction) {
  const [row] = await sequelize.query(
    `SELECT 1 FROM payrolls
      WHERE company_id = :companyId
        AND user_id = :userId
        AND pay_period = :payPeriod
        AND status = 'Processed'
      LIMIT 1`,
    {
      replacements: { companyId, userId, payPeriod },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  return Boolean(row);
}
async function listBonuses(companyId, filters = {}) {
  try {
    const {
      userUuid,
      search,
      page = 1,
      limit = 10,
      sortBy = "payPeriod",
      sortOrder = "DESC",
    } = filters;

    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (currentPage - 1) * pageSize;

    // Build WHERE conditions
    const conditions = ["b.company_id = :companyId"];

    const replacements = {
      companyId,
      limit: pageSize,
      offset,
    };

    if (userUuid) {
      conditions.push("u.uuid = :userUuid");
      replacements.userUuid = userUuid;
    }

    if (search?.trim()) {
      conditions.push(`
        (
          u.first_name ILIKE :search
          OR u.last_name ILIKE :search
          OR u.email ILIKE :search
          OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :search
        )
      `);

      replacements.search = `%${search.trim()}%`;
    }

    const whereClause = conditions.join(" AND ");

    // Whitelist sortable columns
    const sortColumns = {
      payPeriod: "b.pay_period",
      bonusType: "b.bonus_type",
      amount: "b.amount",
      createdAt: "b.created_at",
      firstName: "u.first_name",
      lastName: "u.last_name",
    };

    const orderColumn = sortColumns[sortBy] || "b.pay_period";
    const orderDirection =
      String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Get total count
    const countResult = await sequelize.query(
      `
        SELECT COUNT(*) AS total
        FROM employee_bonuses b
        JOIN users u ON u.id = b.user_id
        WHERE ${whereClause}
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    const total = Number(countResult[0]?.total || 0);

    // Get paginated records
    const rows = await sequelize.query(
      `
        SELECT
          b.uuid,
          b.pay_period AS "payPeriod",
          b.bonus_type AS "bonusType",
          b.amount,
          b.reason,
          b.created_at AS "createdAt",
          u.uuid AS "userUuid",
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.email
        FROM employee_bonuses b
        JOIN users u ON u.id = b.user_id
        WHERE ${whereClause}
        ORDER BY ${orderColumn} ${orderDirection}, b.created_at DESC
        LIMIT :limit
        OFFSET :offset
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );

    logger.info("Bonuses fetched", {
      companyId,
      count: rows.length,
      total,
      page: currentPage,
    });

    return {
      rows: rows.map(toResponse),
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    logger.error("Failed to fetch bonuses", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function createBonus(companyId, createdByUserId, data) {
  try {
    const bonusUuid = await sequelize.transaction(async (transaction) => {
      const user = await findPayableUser(data.userUuid, companyId, transaction);
      if (!user)
        throw httpError(400, "Select a valid employee from the suggestions");

      const payPeriod = monthToPeriod(data.payPeriod);
      if (
        await isPayrollProcessed(companyId, user.id, payPeriod, transaction)
      ) {
        throw httpError(
          409,
          "Payroll for this employee and month is already processed",
        );
      }

      const bonus = await EmployeeBonus.create(
        {
          companyId,
          userId: user.id,
          payPeriod,
          bonusType: data.bonusType,
          amount: roundMoney(data.amount),
          reason: data.reason ? data.reason.trim() || null : null,
          createdBy: createdByUserId,
        },
        { transaction },
      );
      return bonus.uuid;
    });

    logger.info("Bonus created", {
      companyId,
      bonusUuid,
      createdBy: createdByUserId,
    });
    const [created] = (await listBonuses(companyId)).filter(
      (b) => b.uuid === bonusUuid,
    );
    return created;
  } catch (error) {
    logger.error("Failed to create bonus", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function deleteBonus(uuid, companyId) {
  try {
    await sequelize.transaction(async (transaction) => {
      const bonus = await EmployeeBonus.findOne({
        where: { uuid, companyId },
        transaction,
      });
      if (!bonus) throw httpError(404, "Bonus not found");

      if (
        await isPayrollProcessed(
          companyId,
          bonus.userId,
          bonus.payPeriod,
          transaction,
        )
      ) {
        throw httpError(
          409,
          "Payroll for this month is already processed — bonus can't be deleted",
        );
      }

      await bonus.destroy({ transaction });
    });

    logger.info("Bonus deleted", { companyId, bonusUuid: uuid });
  } catch (error) {
    logger.error("Failed to delete bonus", {
      companyId,
      bonusUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

// Sum of an employee's bonuses for one month — used to auto-fill payroll
async function getBonusTotal(companyId, { userUuid, payPeriod }) {
  const [row] = await sequelize.query(
    `SELECT COALESCE(SUM(b.amount), 0) AS total, COUNT(*)::int AS count
       FROM employee_bonuses b
       JOIN users u ON u.id = b.user_id
      WHERE b.company_id = :companyId
        AND u.uuid = :userUuid
        AND b.pay_period = :payPeriod`,
    {
      replacements: {
        companyId,
        userUuid,
        payPeriod: monthToPeriod(payPeriod),
      },
      type: QueryTypes.SELECT,
    },
  );
  return { total: Number(row.total), count: row.count };
}

module.exports = {
  listBonuses,
  createBonus,
  deleteBonus,
  getBonusTotal,
};
