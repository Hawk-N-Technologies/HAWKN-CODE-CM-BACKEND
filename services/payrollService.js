const { Op, QueryTypes, UniqueConstraintError } = require("@sequelize/core");
const sequelize = require("../config/db");
const { User, Payroll } = require("../models/associations");
const logger = require("../utils/logger");

const SUGGESTION_LIMIT = 8;
const MAX_LIST_ROWS = 500; // safety cap until the table gets pagination

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Money math in whole paise (integers) — avoids 0.1 + 0.2 = 0.30000000000000004
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => paise / 100;

// "2026-09" → "2026-09-01" (DB stores the 1st of the month)
const monthToPeriod = (yyyyMm) => `${yyyyMm}-01`;

// Joi turns "2026-09-29" into a Date — back to plain "YYYY-MM-DD"
const toDateString = (date) => new Date(date).toISOString().slice(0, 10);

// First day of that date's month: "2026-08-31" → "2026-08-01"
const monthStartOf = (dateString) => `${dateString.slice(0, 7)}-01`;

// Makes the user's text literal inside LIKE: "mira_" must not match "miraX"
const escapeLike = (text) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

// What the frontend gets — UUIDs only, numbers as numbers
function toResponse(payroll) {
  const employee = payroll.employee;

  return {
    uuid: payroll.uuid,
    payPeriod: String(payroll.payPeriod).slice(0, 7), // "2026-09"
    baseSalary: Number(payroll.baseSalary),
    lopDeduction: Number(payroll.lopDeduction),
    bonus: Number(payroll.bonus),
    netSalary: Number(payroll.netSalary),
    paymentMethod: payroll.paymentMethod,
    status: payroll.status,
    processedAt: payroll.processedAt,
    createdAt: payroll.createdAt,
    employee: employee
      ? {
          uuid: employee.uuid,
          firstName: employee.firstName,
          lastName: employee.lastName,
          fullName: [employee.firstName, employee.lastName].filter(Boolean).join(" "),
          email: employee.email,
        }
      : null,
  };
}

const EMPLOYEE_INCLUDE = {
  model: User,
  as: "employee",
  attributes: ["uuid", "firstName", "lastName", "email"],
};

// Only active, non-client users of THIS company can be paid
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
    { replacements: { userUuid, companyId }, type: QueryTypes.SELECT, transaction },
  );

  return user || null;
}

// ---------------------------------------------------------------------------
// Name autocomplete
// ---------------------------------------------------------------------------

/**
 * Suggestions while HR types a name. Plain SQL prefix matching:
 * matches the START of first name, last name, full name, or email
 * (case-insensitive). Best matches first:
 *   0 = first name starts with it   ("joh"    → "John Doe")
 *   1 = full name starts with it    ("john d" → "John Doe")
 *   2 = last name starts with it    ("sha"    → "Ishita Shah")
 *   3 = email starts with it        ("tejp"   → tejprakash@…)
 * Values are passed as replacements (never glued into SQL) → no SQL injection.
 *
 * Each suggestion also carries the employee's salary (or null), so the
 * payroll form can auto-fill Base Salary the moment a name is picked.
 * onlyEmployees: true → only users who have an employee record
 * (used by Salary Structure, since salaries belong to employees).
 */
async function searchEmployees(companyId, q, { onlyEmployees = false } = {}) {
  try {
    const prefix = `${escapeLike(q.trim())}%`;

    const rows = await sequelize.query(
      `SELECT u.uuid,
              u.first_name AS "firstName",
              u.last_name  AS "lastName",
              u.email,
              r.name       AS "role",
              s.salary
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN employees e
                ON e.user_id = u.id
               AND e.company_id = u.company_id
         LEFT JOIN employee_salaries s ON s.employee_id = e.id
        WHERE u.company_id = :companyId
          AND u.is_active = TRUE
          AND r.name <> 'client'
          ${onlyEmployees ? "AND e.id IS NOT NULL" : ""}
          AND (
                u.first_name ILIKE :prefix
             OR u.last_name  ILIKE :prefix
             OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE :prefix
             OR u.email      ILIKE :prefix
          )
        ORDER BY
          CASE
            WHEN u.first_name ILIKE :prefix THEN 0
            WHEN CONCAT_WS(' ', u.first_name, u.last_name) ILIKE :prefix THEN 1
            WHEN u.last_name  ILIKE :prefix THEN 2
            ELSE 3
          END,
          LENGTH(u.first_name),   -- shorter (closer) names first: "John" before "Johnny"
          u.first_name,
          u.last_name
        LIMIT :limit`,
      {
        replacements: { companyId, prefix, limit: SUGGESTION_LIMIT },
        type: QueryTypes.SELECT,
      },
    );

    return rows.map((row) => ({
      uuid: row.uuid,
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      role: row.role,
      salary: row.salary === null ? null : Number(row.salary),
    }));
  } catch (error) {
    logger.error("Employee search for payroll failed", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Payroll
// ---------------------------------------------------------------------------

/**
 * List payroll with optional filters (all combinable):
 *  - startDate / endDate → every pay MONTH that falls in the range.
 *    Payroll is monthly, so 31 Aug → 29 Sep returns August AND September.
 *  - userUuid → one exact employee (picked from autocomplete)
 *  - status   → Pending / Processed
 */
async function listPayroll(companyId, filters = {}) {
  try {
    const where = { companyId };

    if (filters.startDate || filters.endDate) {
      where.payPeriod = {};
      if (filters.startDate) {
        where.payPeriod[Op.gte] = monthStartOf(toDateString(filters.startDate));
      }
      if (filters.endDate) {
        where.payPeriod[Op.lte] = toDateString(filters.endDate);
      }
    }

    if (filters.status) where.status = filters.status;

    const include = { ...EMPLOYEE_INCLUDE };
    if (filters.userUuid) {
      include.where = { uuid: filters.userUuid, companyId };
      include.required = true;
    }

    const rows = await Payroll.findAll({
      where,
      include: [include],
      order: [
        ["payPeriod", "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: MAX_LIST_ROWS,
    });

    logger.info("Payroll list fetched", { companyId, count: rows.length, filters });
    return rows.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch payroll", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create a payroll entry. Net salary is ALWAYS calculated here —
 * whatever the client sends for it is ignored (Joi strips it).
 */
async function createPayroll(companyId, createdByUserId, data) {
  try {
    const payrollUuid = await sequelize.transaction(async (transaction) => {
      const user = await findPayableUser(data.userUuid, companyId, transaction);
      if (!user) {
        throw httpError(400, "Select a valid employee from the suggestions");
      }

      const payPeriod = monthToPeriod(data.payPeriod);

      const existing = await Payroll.findOne({
        where: { companyId, userId: user.id, payPeriod },
        attributes: ["id"],
        transaction,
      });
      if (existing) {
        throw httpError(409, "Payroll for this employee and month already exists");
      }

      const netPaise =
        toPaise(data.baseSalary) - toPaise(data.lopDeduction) + toPaise(data.bonus);

      const payroll = await Payroll.create(
        {
          companyId,
          userId: user.id,
          payPeriod,
          baseSalary: toRupees(toPaise(data.baseSalary)),
          lopDeduction: toRupees(toPaise(data.lopDeduction)),
          bonus: toRupees(toPaise(data.bonus)),
          netSalary: toRupees(netPaise),
          paymentMethod: data.paymentMethod,
          status: "Pending",
          createdBy: createdByUserId,
        },
        { transaction },
      );

      return payroll.uuid;
    });

    logger.info("Payroll created", { companyId, payrollUuid, createdBy: createdByUserId });
    return getPayrollByUuid(payrollUuid, companyId);
  } catch (error) {
    // Two HR users creating the same employee+month at the same moment
    if (error instanceof UniqueConstraintError) {
      throw httpError(409, "Payroll for this employee and month already exists");
    }

    logger.error("Failed to create payroll", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function getPayrollByUuid(uuid, companyId) {
  const payroll = await Payroll.findOne({
    where: { uuid, companyId },
    include: [EMPLOYEE_INCLUDE],
  });
  if (!payroll) throw httpError(404, "Payroll record not found");
  return toResponse(payroll);
}

/**
 * Pending → Processed. Once processed the record is locked.
 * Single conditional UPDATE, so two clicks at once can't process twice.
 */
async function processPayroll(uuid, companyId, processedByUserId) {
  try {
    const [updatedCount] = await Payroll.update(
      { status: "Processed", processedAt: new Date(), processedBy: processedByUserId },
      { where: { uuid, companyId, status: "Pending" } },
    );

    if (updatedCount === 0) {
      // Tell apart "doesn't exist" from "already processed"
      const payroll = await Payroll.findOne({ where: { uuid, companyId }, attributes: ["status"] });
      if (!payroll) throw httpError(404, "Payroll record not found");
      throw httpError(409, "Payroll is already processed");
    }

    logger.info("Payroll processed", { companyId, payrollUuid: uuid, processedBy: processedByUserId });
    return getPayrollByUuid(uuid, companyId);
  } catch (error) {
    logger.error("Failed to process payroll", {
      companyId,
      payrollUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Edit a Pending payroll: amounts + payment method only.
 * Net salary is recalculated here. One conditional UPDATE (status = Pending),
 * so a payroll processed a split second earlier can't be edited.
 */
async function updatePayroll(uuid, companyId, data) {
  try {
    const netPaise =
      toPaise(data.baseSalary) - toPaise(data.lopDeduction) + toPaise(data.bonus);

    const [updatedCount] = await Payroll.update(
      {
        baseSalary: toRupees(toPaise(data.baseSalary)),
        lopDeduction: toRupees(toPaise(data.lopDeduction)),
        bonus: toRupees(toPaise(data.bonus)),
        netSalary: toRupees(netPaise),
        paymentMethod: data.paymentMethod,
      },
      { where: { uuid, companyId, status: "Pending" } },
    );

    if (updatedCount === 0) {
      const payroll = await Payroll.findOne({ where: { uuid, companyId }, attributes: ["status"] });
      if (!payroll) throw httpError(404, "Payroll record not found");
      throw httpError(409, "Processed payroll can't be edited");
    }

    logger.info("Payroll updated", { companyId, payrollUuid: uuid });
    return getPayrollByUuid(uuid, companyId);
  } catch (error) {
    logger.error("Failed to update payroll", {
      companyId,
      payrollUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Delete a Pending payroll (e.g. created by mistake).
 * Processed payroll is financial history and can never be deleted.
 */
async function deletePayroll(uuid, companyId) {
  try {
    const deletedCount = await Payroll.destroy({
      where: { uuid, companyId, status: "Pending" },
    });

    if (deletedCount === 0) {
      const payroll = await Payroll.findOne({ where: { uuid, companyId }, attributes: ["status"] });
      if (!payroll) throw httpError(404, "Payroll record not found");
      throw httpError(409, "Processed payroll can't be deleted");
    }

    logger.info("Payroll deleted", { companyId, payrollUuid: uuid });
  } catch (error) {
    logger.error("Failed to delete payroll", {
      companyId,
      payrollUuid: uuid,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  searchEmployees,
  listPayroll,
  createPayroll,
  processPayroll,
  updatePayroll,
  deletePayroll
};