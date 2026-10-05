const { QueryTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const SalaryIncrement = require("../models/SalaryIncrement");
const logger = require("../utils/logger");

const MAX_LIST_ROWS = 500;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;
// ₹60,000 / ₹60,000.50 (never "₹60,000.5")
const formatInr = (value) => {
  const amount = Number(value);
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
};

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Joi turns "2026-10-01" into a Date — back to plain "YYYY-MM-DD"
const toDateString = (date) => new Date(date).toISOString().slice(0, 10);

function toResponse(row) {
  const previous = Number(row.previousSalary);
  const next = Number(row.newSalary);

  return {
    uuid: row.uuid,
    previousSalary: previous,
    newSalary: next,
    increaseAmount: roundMoney(next - previous),
    increasePercent: Math.round(((next - previous) / previous) * 10000) / 100, // 2 decimals
    effectiveDate: row.effectiveDate,
    reason: row.reason,
    createdAt: row.createdAt,
    // Only the newest increment per employee can be reverted
    isLatest: row.rowNumber === 1 || row.rowNumber === "1",
    employee: {
      uuid: row.userUuid,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      role: row.role,
    },
  };
}

async function listIncrements(companyId, { userUuid } = {}) {
  try {
    const rows = await sequelize.query(
      `SELECT i.uuid,
              i.previous_salary AS "previousSalary",
              i.new_salary      AS "newSalary",
              i.effective_date  AS "effectiveDate",
              i.reason,
              i.created_at      AS "createdAt",
              ROW_NUMBER() OVER (PARTITION BY i.employee_id ORDER BY i.id DESC) AS "rowNumber",
              u.uuid            AS "userUuid",
              u.first_name      AS "firstName",
              u.last_name       AS "lastName",
              u.email,
              r.name            AS "role"
         FROM salary_increments i
         JOIN employees e ON e.id = i.employee_id
         JOIN users u     ON u.id = e.user_id
         JOIN roles r     ON r.id = u.role_id
        WHERE e.company_id = :companyId
          ${userUuid ? "AND u.uuid = :userUuid" : ""}
        ORDER BY i.id DESC
        LIMIT :limit`,
      {
        replacements: { companyId, userUuid: userUuid ?? null, limit: MAX_LIST_ROWS },
        type: QueryTypes.SELECT,
      },
    );

    logger.info("Increments fetched", { companyId, count: rows.length });
    return rows.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch increments", { companyId, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Give an increment: records previous → new salary AND updates
 * Salary Structure, all in one transaction. The salary row is locked
 * (FOR UPDATE) so two HR users can't raise the same salary at once.
 */
async function createIncrement(companyId, createdByUserId, data) {
  const effectiveDate = toDateString(data.effectiveDate);
  if (effectiveDate > todayIst()) {
    throw httpError(400, "Effective date can't be in the future");
  }

  try {
    const incrementUuid = await sequelize.transaction(async (transaction) => {
      const [current] = await sequelize.query(
        `SELECT e.id AS "employeeId", s.id AS "salaryId", s.salary
           FROM employees e
           JOIN users u ON u.id = e.user_id
           JOIN roles r ON r.id = u.role_id
           LEFT JOIN employee_salaries s ON s.employee_id = e.id
          WHERE u.uuid = :userUuid
            AND e.company_id = :companyId
            AND u.is_active = TRUE
            AND r.name <> 'client'
          LIMIT 1
          FOR UPDATE OF e`,
        { replacements: { userUuid: data.userUuid, companyId }, type: QueryTypes.SELECT, transaction },
      );

      if (!current) throw httpError(400, "Select a valid employee from the suggestions");
      if (current.salaryId === null) {
        throw httpError(400, "This employee has no salary yet — set it in Payroll → Salary Structure first");
      }

      const previousSalary = Number(current.salary);
      const newSalary = roundMoney(data.newSalary);
      if (newSalary <= previousSalary) {
        throw httpError(400, `New salary must be higher than the current salary (${formatInr(previousSalary)})`);
      }

      const increment = await SalaryIncrement.create(
        {
          employeeId: current.employeeId,
          previousSalary,
          newSalary,
          effectiveDate,
          reason: data.reason ? data.reason.trim() || null : null,
          createdBy: createdByUserId,
        },
        { transaction },
      );

      await sequelize.query(`UPDATE employee_salaries SET salary = :newSalary WHERE id = :salaryId`, {
        replacements: { newSalary, salaryId: current.salaryId },
        transaction,
      });

      return increment.uuid;
    });

    logger.info("Increment created", { companyId, incrementUuid, createdBy: createdByUserId });
    const [created] = (await listIncrements(companyId)).filter((i) => i.uuid === incrementUuid);
    return created;
  } catch (error) {
    logger.error("Failed to create increment", { companyId, error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Shared guard for Edit + Revert: the increment must be this employee's
 * LATEST one, and Salary Structure must still show its new salary
 * (nobody changed the salary since). Locks the employee row.
 */
async function lockEditableIncrement(uuid, companyId, transaction) {
  const [increment] = await sequelize.query(
    `SELECT i.id, i.employee_id AS "employeeId", i.previous_salary AS "previousSalary",
            i.new_salary AS "newSalary"
       FROM salary_increments i
       JOIN employees e ON e.id = i.employee_id
      WHERE i.uuid = :uuid
        AND e.company_id = :companyId
      FOR UPDATE OF e`,
    { replacements: { uuid, companyId }, type: QueryTypes.SELECT, transaction },
  );
  if (!increment) throw httpError(404, "Increment not found");

  const [latest] = await sequelize.query(
    `SELECT MAX(id) AS "maxId" FROM salary_increments WHERE employee_id = :employeeId`,
    { replacements: { employeeId: increment.employeeId }, type: QueryTypes.SELECT, transaction },
  );
  if (Number(latest.maxId) !== Number(increment.id)) {
    throw httpError(409, "Only the latest increment can be changed");
  }

  const [salary] = await sequelize.query(
    `SELECT id, salary FROM employee_salaries WHERE employee_id = :employeeId`,
    { replacements: { employeeId: increment.employeeId }, type: QueryTypes.SELECT, transaction },
  );
  if (!salary || Number(salary.salary) !== Number(increment.newSalary)) {
    throw httpError(409, "Salary was changed after this increment — it can't be changed automatically");
  }

  return { increment, salary };
}

/**
 * Edit the latest increment: new salary / effective date / reason.
 * Previous salary stays fixed; Salary Structure is updated in the same
 * transaction so the two never disagree.
 */
async function updateIncrement(uuid, companyId, data) {
  const effectiveDate = toDateString(data.effectiveDate);
  if (effectiveDate > todayIst()) {
    throw httpError(400, "Effective date can't be in the future");
  }

  try {
    await sequelize.transaction(async (transaction) => {
      const { increment, salary } = await lockEditableIncrement(uuid, companyId, transaction);

      const previousSalary = Number(increment.previousSalary);
      const newSalary = roundMoney(data.newSalary);
      if (newSalary <= previousSalary) {
        throw httpError(400, `New salary must be higher than the previous salary (${formatInr(previousSalary)})`);
      }

      await sequelize.query(
        `UPDATE salary_increments
            SET new_salary = :newSalary, effective_date = :effectiveDate, reason = :reason
          WHERE id = :id`,
        {
          replacements: {
            newSalary,
            effectiveDate,
            reason: data.reason ? data.reason.trim() || null : null,
            id: increment.id,
          },
          transaction,
        },
      );

      await sequelize.query(`UPDATE employee_salaries SET salary = :newSalary WHERE id = :id`, {
        replacements: { newSalary, id: salary.id },
        transaction,
      });
    });

    logger.info("Increment updated", { companyId, incrementUuid: uuid });
    const [updated] = (await listIncrements(companyId)).filter((i) => i.uuid === uuid);
    return updated;
  } catch (error) {
    logger.error("Failed to update increment", { companyId, incrementUuid: uuid, error: error.message });
    throw error;
  }
}

/**
 * Revert = undo a mistaken increment. Only the LATEST increment of an
 * employee, and only if their salary hasn't been changed since
 * (Salary Structure still shows this increment's new salary).
 */
async function revertIncrement(uuid, companyId) {
  try {
    await sequelize.transaction(async (transaction) => {
      const { increment, salary } = await lockEditableIncrement(uuid, companyId, transaction);

      await sequelize.query(`UPDATE employee_salaries SET salary = :previous WHERE id = :id`, {
        replacements: { previous: increment.previousSalary, id: salary.id },
        transaction,
      });
      await sequelize.query(`DELETE FROM salary_increments WHERE id = :id`, {
        replacements: { id: increment.id },
        transaction,
      });
    });

    logger.info("Increment reverted", { companyId, incrementUuid: uuid });
  } catch (error) {
    logger.error("Failed to revert increment", { companyId, incrementUuid: uuid, error: error.message });
    throw error;
  }
}

module.exports = {
  listIncrements,
  createIncrement,
  updateIncrement,
  revertIncrement,
};