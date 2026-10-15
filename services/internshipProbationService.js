const { QueryTypes, UniqueConstraintError } = require("@sequelize/core");
const sequelize = require("../config/db");
const InternshipProbationPeriod = require("../models/InternshipProbationPeriod");
const logger = require("../utils/logger");

const MAX_PERIOD_DAYS = 730; // a period can't run longer than 2 years
const DUE_SOON_DAYS = 14; // "due soon" warning window
const MAX_LIST_ROWS = 500; // safety cap until the table gets pagination

// employees.employment_type for each period type
const EMPLOYMENT_TYPE_FOR = { Internship: "Intern", Probation: "Probation" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Joi turns "2026-10-01" into a Date — back to plain "YYYY-MM-DD"
const toDateString = (date) => new Date(date).toISOString().slice(0, 10);

// Whole days between two "YYYY-MM-DD" dates (UTC → no daylight-saving drift)
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const cleanNotes = (notes) => (notes ? notes.trim() || null : null);

function toResponse(row) {
  const isActive = row.status === "Active";
  const endDate = String(row.endDate).slice(0, 10);
  const daysLeft = isActive ? daysBetween(todayIst(), endDate) : null;

  return {
    uuid: row.uuid,
    periodType: row.periodType,
    startDate: String(row.startDate).slice(0, 10),
    endDate,
    originalEndDate: String(row.originalEndDate).slice(0, 10),
    extensionCount: Number(row.extensionCount),
    stipend: row.stipend === null ? null : Number(row.stipend),
    performance: row.performance,
    notes: row.notes,
    status: row.status,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    // Only meaningful while active
    daysLeft,
    isOverdue: isActive && daysLeft < 0,
    isDueSoon: isActive && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    employee: {
      uuid: row.userUuid,
      fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      email: row.email,
      role: row.role,
      employmentType: row.employmentType,
      employmentStatus: row.employmentStatus,
    },
  };
}

const LIST_SQL = `
  SELECT p.uuid,
         p.period_type       AS "periodType",
         p.start_date        AS "startDate",
         p.end_date          AS "endDate",
         p.original_end_date AS "originalEndDate",
         p.extension_count   AS "extensionCount",
         p.stipend,
         p.performance,
         p.notes,
         p.status,
         p.closed_at         AS "closedAt",
         p.created_at        AS "createdAt",
         u.uuid              AS "userUuid",
         u.first_name        AS "firstName",
         u.last_name         AS "lastName",
         u.email,
         r.name              AS "role",
         e.employment_type   AS "employmentType",
         e.employment_status AS "employmentStatus"
    FROM internship_probation_periods p
    JOIN employees e ON e.id = p.employee_id
    JOIN users u     ON u.id = e.user_id
    JOIN roles r     ON r.id = u.role_id
   WHERE p.company_id = :companyId
`;

async function getOne(uuid, companyId) {
  const [row] = await sequelize.query(`${LIST_SQL} AND p.uuid = :uuid`, {
    replacements: { companyId, uuid },
    type: QueryTypes.SELECT,
  });
  return row ? toResponse(row) : null;
}

/**
 * Locks an ACTIVE period + its employee for the rest of the transaction,
 * so two HR users can't extend / close the same period at once.
 */
async function lockActivePeriod(uuid, companyId, transaction) {
  const [period] = await sequelize.query(
    `SELECT p.id, p.employee_id AS "employeeId", p.period_type AS "periodType",
            p.start_date AS "startDate", p.end_date AS "endDate", p.status
       FROM internship_probation_periods p
       JOIN employees e ON e.id = p.employee_id
      WHERE p.uuid = :uuid
        AND p.company_id = :companyId
      FOR UPDATE OF p, e`,
    { replacements: { uuid, companyId }, type: QueryTypes.SELECT, transaction },
  );

  if (!period) throw httpError(404, "Record not found");
  if (period.status !== "Active") {
    throw httpError(409, `This ${period.periodType.toLowerCase()} is already closed (${period.status})`);
  }
  return {
    ...period,
    startDate: String(period.startDate).slice(0, 10),
    endDate: String(period.endDate).slice(0, 10),
  };
}

function checkLength(startDate, endDate) {
  if (endDate <= startDate) throw httpError(400, "End date must be after the start date");
  if (daysBetween(startDate, endDate) > MAX_PERIOD_DAYS) {
    throw httpError(400, "A period can't be longer than 2 years");
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function listPeriods(companyId, { periodType, status, userUuid } = {}) {
  try {
    const rows = await sequelize.query(
      `${LIST_SQL}
       ${periodType ? "AND p.period_type = :periodType" : ""}
       ${status ? "AND p.status = :status" : ""}
       ${userUuid ? "AND u.uuid = :userUuid" : ""}
       ORDER BY (p.status = 'Active') DESC, p.end_date ASC, p.id DESC
       LIMIT :limit`,
      {
        replacements: {
          companyId,
          periodType: periodType ?? null,
          status: status ?? null,
          userUuid: userUuid ?? null,
          limit: MAX_LIST_ROWS,
        },
        type: QueryTypes.SELECT,
      },
    );

    logger.info("Internship/probation periods fetched", { companyId, count: rows.length });
    return rows.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch internship/probation periods", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Start an internship / probation. Also sets the employee's
 * employment_type to Intern / Probation, in the same transaction.
 */
async function createPeriod(companyId, createdByUserId, data) {
  const startDate = toDateString(data.startDate);
  const endDate = toDateString(data.endDate);
  checkLength(startDate, endDate);

  if (data.periodType === "Probation" && data.stipend !== undefined && data.stipend !== null) {
    throw httpError(400, "Stipend applies to internships only");
  }

  try {
    const uuid = await sequelize.transaction(async (transaction) => {
      // Active, non-client, not-exited employee of THIS company (locked)
      const [employee] = await sequelize.query(
        `SELECT e.id
           FROM employees e
           JOIN users u ON u.id = e.user_id
           JOIN roles r ON r.id = u.role_id
          WHERE u.uuid = :userUuid
            AND e.company_id = :companyId
            AND u.is_active = TRUE
            AND r.name <> 'client'
            AND e.employment_status <> 'Exited'
          LIMIT 1
          FOR UPDATE OF e`,
        { replacements: { userUuid: data.userUuid, companyId }, type: QueryTypes.SELECT, transaction },
      );
      if (!employee) throw httpError(400, "Select a valid employee from the suggestions");

      const [active] = await sequelize.query(
        `SELECT period_type AS "periodType" FROM internship_probation_periods
          WHERE employee_id = :employeeId AND status = 'Active' LIMIT 1`,
        { replacements: { employeeId: employee.id }, type: QueryTypes.SELECT, transaction },
      );
      if (active) {
        throw httpError(409, `This employee already has an active ${active.periodType.toLowerCase()}`);
      }

      const period = await InternshipProbationPeriod.create(
        {
          companyId,
          employeeId: employee.id,
          periodType: data.periodType,
          startDate,
          endDate,
          originalEndDate: endDate,
          stipend:
            data.periodType === "Internship" && data.stipend !== undefined && data.stipend !== null
              ? roundMoney(data.stipend)
              : null,
          performance: data.performance,
          notes: cleanNotes(data.notes),
          createdBy: createdByUserId,
        },
        { transaction },
      );

      await sequelize.query(
        `UPDATE employees SET employment_type = :type, updated_at = NOW() WHERE id = :id`,
        { replacements: { type: EMPLOYMENT_TYPE_FOR[data.periodType], id: employee.id }, transaction },
      );

      return period.uuid;
    });

    logger.info("Internship/probation started", { companyId, uuid, periodType: data.periodType });
    return getOne(uuid, companyId);
  } catch (error) {
    // Two HR users starting a period for the same employee at once
    if (error instanceof UniqueConstraintError) {
      throw httpError(409, "This employee already has an active internship or probation");
    }
    logger.error("Failed to start internship/probation", { companyId, error: error.message, stack: error.stack });
    throw error;
  }
}

// Review: performance / notes / stipend — active periods only
async function reviewPeriod(uuid, companyId, data) {
  try {
    await sequelize.transaction(async (transaction) => {
      const period = await lockActivePeriod(uuid, companyId, transaction);

      const hasStipend = data.stipend !== undefined && data.stipend !== null;
      if (period.periodType === "Probation" && hasStipend) {
        throw httpError(400, "Stipend applies to internships only");
      }

      await sequelize.query(
        `UPDATE internship_probation_periods
            SET performance = :performance,
                notes       = :notes,
                stipend     = CASE WHEN :stipendGiven THEN CAST(:stipend AS NUMERIC(12,2)) ELSE stipend END,
                updated_at  = NOW()
          WHERE id = :id`,
        {
          replacements: {
            performance: data.performance,
            notes: cleanNotes(data.notes),
            // stipend key sent → set it (null clears it); not sent → keep current
            stipendGiven: data.stipend !== undefined,
            stipend: hasStipend ? roundMoney(data.stipend) : null,
            id: period.id,
          },
          transaction,
        },
      );
    });

    logger.info("Internship/probation reviewed", { companyId, uuid, performance: data.performance });
    return getOne(uuid, companyId);
  } catch (error) {
    logger.error("Failed to review internship/probation", { companyId, uuid, error: error.message });
    throw error;
  }
}

// Extend: move the end date later. Original end date is kept.
async function extendPeriod(uuid, companyId, data) {
  const newEndDate = toDateString(data.newEndDate);

  try {
    await sequelize.transaction(async (transaction) => {
      const period = await lockActivePeriod(uuid, companyId, transaction);

      if (newEndDate <= period.endDate) {
        throw httpError(400, `New end date must be after the current end date (${period.endDate})`);
      }
      checkLength(period.startDate, newEndDate);

      await sequelize.query(
        `UPDATE internship_probation_periods
            SET end_date        = :newEndDate,
                extension_count = extension_count + 1,
                notes           = COALESCE(:notes, notes),
                updated_at      = NOW()
          WHERE id = :id`,
        { replacements: { newEndDate, notes: cleanNotes(data.notes), id: period.id }, transaction },
      );
    });

    logger.info("Internship/probation extended", { companyId, uuid, newEndDate });
    return getOne(uuid, companyId);
  } catch (error) {
    logger.error("Failed to extend internship/probation", { companyId, uuid, error: error.message });
    throw error;
  }
}

/**
 * Close an active period:
 *  - Confirmed  → employee becomes Full Time
 *  - Converted  → (internship only) internship closes, a Probation period
 *                 starts today and runs to probationEndDate
 *  - Ended      → (internship only) internship finished, employee Exited
 *  - Terminated → let go, employee Exited
 * Everything happens in one transaction.
 */
async function closePeriod(uuid, companyId, closedByUserId, data) {
  const today = todayIst();

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const period = await lockActivePeriod(uuid, companyId, transaction);
      const { outcome } = data;

      if ((outcome === "Converted" || outcome === "Ended") && period.periodType !== "Internship") {
        throw httpError(400, `"${outcome}" only applies to internships`);
      }

      let probationEndDate = null;
      if (outcome === "Converted") {
        probationEndDate = toDateString(data.probationEndDate);
        if (probationEndDate <= today) {
          throw httpError(400, "Probation end date must be after today");
        }
        checkLength(today, probationEndDate);
      }

      // 1) Close this period
      await sequelize.query(
        `UPDATE internship_probation_periods
            SET status     = :outcome,
                closed_at  = NOW(),
                closed_by  = :closedBy,
                notes      = COALESCE(:notes, notes),
                updated_at = NOW()
          WHERE id = :id`,
        {
          replacements: { outcome, closedBy: closedByUserId, notes: cleanNotes(data.notes), id: period.id },
          transaction,
        },
      );

      // 2) Update the employee (field name comes from this fixed map, never from the request)
      const employeeChange = {
        Confirmed: { field: "employment_type", value: "Full Time" },
        Converted: { field: "employment_type", value: "Probation" },
        Ended: { field: "employment_status", value: "Exited" },
        Terminated: { field: "employment_status", value: "Exited" },
      }[outcome];

      await sequelize.query(
        `UPDATE employees SET ${employeeChange.field} = :value, updated_at = NOW() WHERE id = :id`,
        { replacements: { value: employeeChange.value, id: period.employeeId }, transaction },
      );

      // 3) Intern → probation: open the probation period
      let probationUuid = null;
      if (outcome === "Converted") {
        const probation = await InternshipProbationPeriod.create(
          {
            companyId,
            employeeId: period.employeeId,
            periodType: "Probation",
            startDate: today,
            endDate: probationEndDate,
            originalEndDate: probationEndDate,
            notes: "Converted from internship",
            createdBy: closedByUserId,
          },
          { transaction },
        );
        probationUuid = probation.uuid;
      }

      return { probationUuid };
    });

    logger.info("Internship/probation closed", { companyId, uuid, outcome: data.outcome });
    return {
      closed: await getOne(uuid, companyId),
      probation: result.probationUuid ? await getOne(result.probationUuid, companyId) : null,
    };
  } catch (error) {
    logger.error("Failed to close internship/probation", { companyId, uuid, error: error.message });
    throw error;
  }
}

module.exports = {
  listPeriods,
  createPeriod,
  reviewPeriod,
  extendPeriod,
  closePeriod,
};