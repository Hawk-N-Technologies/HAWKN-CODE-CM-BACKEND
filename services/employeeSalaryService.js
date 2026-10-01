const { QueryTypes, UniqueConstraintError } = require("@sequelize/core");
const sequelize = require("../config/db");
const { EmployeeSalary } = require("../models/associations");
const logger = require("../utils/logger");

const MAX_LIST_ROWS = 500; // safety cap until the table gets pagination

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Money in whole paise — avoids floating-point rounding errors
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

// One row of the Salary Structure table, as the frontend sees it.
// The salary table has no company_id, so company scoping always goes
// through employees.company_id.
const LIST_SQL = `
  SELECT s.uuid,
         s.salary,
         u.uuid       AS "userUuid",
         u.first_name AS "firstName",
         u.last_name  AS "lastName",
         u.email,
         r.name       AS "role"
    FROM employee_salaries s
    JOIN employees e ON e.id = s.employee_id
    JOIN users u     ON u.id = e.user_id
    JOIN roles r     ON r.id = u.role_id
   WHERE e.company_id = :companyId
`;

function toResponse(row) {
  return {
    uuid: row.uuid,
    salary: Number(row.salary),
    employee: {
      uuid: row.userUuid, // user UUID — same one the autocomplete returns
      firstName: row.firstName,
      lastName: row.lastName,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      role: row.role,
    },
  };
}

/**
 * Salary Structure list. Optional userUuid = one exact employee
 * (picked from autocomplete).
 */
async function listSalaries(companyId, { userUuid } = {}) {
  try {
    const rows = await sequelize.query(
      `${LIST_SQL}
       ${userUuid ? "AND u.uuid = :userUuid" : ""}
       ORDER BY u.first_name, u.last_name
       LIMIT :limit`,
      {
        replacements: { companyId, userUuid: userUuid ?? null, limit: MAX_LIST_ROWS },
        type: QueryTypes.SELECT,
      },
    );

    logger.info("Salary structure fetched", { companyId, count: rows.length });
    return rows.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch salary structure", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Set an employee's salary: creates it the first time, updates it after.
 * Only active, non-client users of THIS company who have an employee
 * record can have a salary.
 */
async function setSalary(companyId, { userUuid, salary }) {
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const [employee] = await sequelize.query(
        `SELECT e.id
           FROM employees e
           JOIN users u ON u.id = e.user_id
           JOIN roles r ON r.id = u.role_id
          WHERE u.uuid = :userUuid
            AND e.company_id = :companyId
            AND u.is_active = TRUE
            AND r.name <> 'client'
          LIMIT 1`,
        { replacements: { userUuid, companyId }, type: QueryTypes.SELECT, transaction },
      );

      if (!employee) {
        throw httpError(400, "Select a valid employee from the suggestions");
      }

      const amount = roundMoney(salary);
      const existing = await EmployeeSalary.findOne({
        where: { employeeId: employee.id },
        transaction,
      });

      if (existing) {
        await existing.update({ salary: amount }, { transaction });
        return { created: false };
      }

      await EmployeeSalary.create({ employeeId: employee.id, salary: amount }, { transaction });
      return { created: true };
    });

    logger.info(result.created ? "Salary created" : "Salary updated", { companyId, userUuid });

    const [row] = await listSalaries(companyId, { userUuid });
    return { record: row, created: result.created };
  } catch (error) {
    // Two HR users setting the same employee's salary at the same moment
    if (error instanceof UniqueConstraintError) {
      throw httpError(409, "Salary for this employee was just set by someone else — refresh and try again");
    }

    logger.error("Failed to set salary", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  listSalaries,
  setSalary,
};