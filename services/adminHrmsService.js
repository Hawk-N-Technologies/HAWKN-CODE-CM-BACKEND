const { QueryTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const logger = require("../utils/logger");

/**
 * Admin HRMS — READ-ONLY views over the HR data.
 * Every function here is a SELECT; nothing in this file can change data.
 * Every query is limited to the admin's own company (companyId from the token).
 * All values are passed as replacements (never glued into SQL) → no SQL injection.
 */

const MAX_ROWS = 1000; // safety cap until these lists get pagination
const DUE_SOON_DAYS = 14;

// Today / this month in India (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const thisMonthIst = () => todayIst().slice(0, 7);

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));
const fullName = (first, last) => [first, last].filter(Boolean).join(" ");
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// Wraps every public function with the same logging
async function run(label, companyId, fn) {
  try {
    const result = await fn();
    logger.info(`Admin HRMS: ${label} fetched`, { companyId });
    return result;
  } catch (error) {
    logger.error(`Admin HRMS: failed to fetch ${label}`, { companyId, error: error.message, stack: error.stack });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Overview cards
// ---------------------------------------------------------------------------

async function getSummary(companyId) {
  return run("summary", companyId, async () => {
    const today = todayIst();
    const month = thisMonthIst();

    const [people] = await select(
      `SELECT COUNT(*) FILTER (WHERE e.employment_status <> 'Exited')::int                                   AS "total",
              COUNT(*) FILTER (WHERE e.employment_status <> 'Exited' AND e.employment_type = 'Full Time')::int AS "fullTime",
              COUNT(*) FILTER (WHERE e.employment_status <> 'Exited' AND e.employment_type = 'Intern')::int    AS "interns",
              COUNT(*) FILTER (WHERE e.employment_status <> 'Exited' AND e.employment_type = 'Probation')::int AS "probation",
              COUNT(*) FILTER (WHERE e.employment_status = 'Exited')::int                                      AS "exited"
         FROM employees e
        WHERE e.company_id = :companyId`,
      { companyId },
    );

    // Present = at least one session marked Present today
    // On leave = an APPROVED leave covering today (full day or half day)
    const [todayStats] = await select(
      `SELECT
         (SELECT COUNT(DISTINCT a.employee_id)::int
            FROM attendances a
           WHERE a.company_id = :companyId AND a.attendance_date = :today AND a.status = 'Present') AS "presentToday",
         (SELECT COUNT(DISTINCT l.employee_id)::int
            FROM employee_leaves l
           WHERE l.company_id = :companyId AND l.leave_date = :today AND l.leave_status = 'APPROVED') AS "onLeaveToday",
         (SELECT COUNT(*)::int
            FROM employee_leaves l
           WHERE l.company_id = :companyId AND l.leave_status = 'PENDING') AS "pendingLeaves",
         -- Counted directly (not "total − present − on leave"): someone half
         -- present + half on leave would otherwise be subtracted twice
         (SELECT COUNT(*)::int
            FROM employees e
           WHERE e.company_id = :companyId
             AND e.employment_status <> 'Exited'
             AND NOT EXISTS (SELECT 1 FROM attendances a
                              WHERE a.employee_id = e.id AND a.attendance_date = :today)
             AND NOT EXISTS (SELECT 1 FROM employee_leaves l
                              WHERE l.employee_id = e.id AND l.leave_date = :today
                                AND l.leave_status = 'APPROVED')) AS "notMarked"`,
      { companyId, today },
    );

    const [payroll] = await select(
      `SELECT COUNT(*) FILTER (WHERE p.status = 'Pending')::int   AS "pending",
              COUNT(*) FILTER (WHERE p.status = 'Processed')::int AS "processed",
              COALESCE(SUM(p.net_salary), 0)                      AS "totalNet"
         FROM payrolls p
        WHERE p.company_id = :companyId AND p.pay_period = :period`,
      { companyId, period: `${month}-01` },
    );

    const [periods] = await select(
      `SELECT COUNT(*) FILTER (WHERE p.end_date < :today)::int AS "overdue",
              COUNT(*) FILTER (WHERE p.end_date >= :today
                                 AND p.end_date <= (:today::date + :dueSoon))::int AS "dueSoon"
         FROM internship_probation_periods p
        WHERE p.company_id = :companyId AND p.status = 'Active'`,
      { companyId, today, dueSoon: DUE_SOON_DAYS },
    );

    return {
      date: today,
      employees: people,
      today: todayStats,
      payroll: { month, ...payroll, totalNet: Number(payroll.totalNet) },
      internshipProbation: periods,
    };
  });
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

async function getEmployees(companyId) {
  return run("employees", companyId, async () => {
    const rows = await select(
      `SELECT e.uuid,
              u.first_name        AS "firstName",
              u.last_name         AS "lastName",
              u.email,
              r.name              AS "role",
              e.phone1            AS "phone",
              e.joining_date      AS "joiningDate",
              e.employment_type   AS "employmentType",
              e.employment_status AS "employmentStatus",
              s.salary
         FROM employees e
         JOIN users u ON u.id = e.user_id
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN employee_salaries s ON s.employee_id = e.id
        WHERE e.company_id = :companyId
        ORDER BY (e.employment_status = 'Exited'), u.first_name, u.last_name
        LIMIT :limit`,
      { companyId, limit: MAX_ROWS },
    );

    return rows.map((row) => ({
      uuid: row.uuid,
      fullName: fullName(row.firstName, row.lastName),
      email: row.email,
      role: row.role,
      phone: row.phone,
      joiningDate: dateOnly(row.joiningDate),
      employmentType: row.employmentType,
      employmentStatus: row.employmentStatus,
      salary: toNumber(row.salary),
    }));
  });
}

// ---------------------------------------------------------------------------
// Attendance for one day (every non-exited employee, marked or not)
// ---------------------------------------------------------------------------

async function getAttendance(companyId, { date } = {}) {
  return run("attendance", companyId, async () => {
    const day = date || todayIst();

    const rows = await select(
      `SELECT e.uuid,
              u.first_name AS "firstName",
              u.last_name  AS "lastName",
              u.email,
              r.name       AS "role",
              MAX(CASE WHEN a.session = 'FIRST_HALF'  THEN a.status END) AS "firstHalf",
              MAX(CASE WHEN a.session = 'SECOND_HALF' THEN a.status END) AS "secondHalf",
              -- Explicitly converted to India time and sent as plain "HH:MM" text,
              -- so neither the DB session timezone nor JSON can shift it
              TO_CHAR(MIN(CASE WHEN a.status = 'Present' THEN a.check_in END) AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS "checkIn",
              (SELECT STRING_AGG(l.leave_type || ' (' || l.leave_session || ')', ', ')
                 FROM employee_leaves l
                WHERE l.employee_id = e.id AND l.leave_date = :day AND l.leave_status = 'APPROVED') AS "leave"
         FROM employees e
         JOIN users u ON u.id = e.user_id
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN attendances a ON a.employee_id = e.id AND a.attendance_date = :day
        WHERE e.company_id = :companyId
          AND e.employment_status <> 'Exited'
        GROUP BY e.id, e.uuid, u.first_name, u.last_name, u.email, r.name
        ORDER BY u.first_name, u.last_name
        LIMIT :limit`,
      { companyId, day, limit: MAX_ROWS },
    );

    return {
      date: day,
      records: rows.map((row) => {
        const present = [row.firstHalf, row.secondHalf].filter((s) => s === "Present").length;
        let dayStatus = "Not Marked";
        if (present === 2) dayStatus = "Present";
        else if (present === 1) dayStatus = "Half Day";
        else if (row.leave) dayStatus = "On Leave";
        else if (row.firstHalf || row.secondHalf) dayStatus = "Absent";

        return {
          uuid: row.uuid,
          fullName: fullName(row.firstName, row.lastName),
          email: row.email,
          role: row.role,
          firstHalf: row.firstHalf,
          secondHalf: row.secondHalf,
          checkIn: row.checkIn,
          leave: row.leave,
          dayStatus,
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Leave & LOP
// ---------------------------------------------------------------------------

async function getLeaves(companyId, { status } = {}) {
  return run("leaves", companyId, async () => {
    const rows = await select(
      `SELECT l.uuid,
              l.leave_date    AS "leaveDate",
              l.leave_type    AS "leaveType",
              l.leave_session AS "leaveSession",
              l.leave_status  AS "leaveStatus",
              l.is_paid       AS "isPaid",
              l.reason,
              l.reviewed_at   AS "reviewedAt",
              u.first_name    AS "firstName",
              u.last_name     AS "lastName",
              u.email,
              rv.first_name   AS "reviewerFirstName",
              rv.last_name    AS "reviewerLastName"
         FROM employee_leaves l
         JOIN employees e ON e.id = l.employee_id
         JOIN users u     ON u.id = e.user_id
         LEFT JOIN users rv ON rv.id = l.reviewed_by
        WHERE l.company_id = :companyId
          ${status ? "AND l.leave_status = :status" : ""}
        ORDER BY (l.leave_status = 'PENDING') DESC, l.leave_date DESC
        LIMIT :limit`,
      { companyId, status: status ?? null, limit: MAX_ROWS },
    );

    return rows.map((row) => ({
      uuid: row.uuid,
      employee: { fullName: fullName(row.firstName, row.lastName), email: row.email },
      leaveDate: dateOnly(row.leaveDate),
      leaveType: row.leaveType,
      leaveSession: row.leaveSession,
      leaveStatus: row.leaveStatus,
      isPaid: row.isPaid,
      // Approved but unpaid = Loss of Pay
      isLop: row.leaveStatus === "APPROVED" && row.isPaid === false,
      reason: row.reason,
      reviewedBy: row.reviewerFirstName ? fullName(row.reviewerFirstName, row.reviewerLastName) : null,
      reviewedAt: row.reviewedAt,
    }));
  });
}

// ---------------------------------------------------------------------------
// Payroll: the month's payroll runs + that month's bonuses + recent increments
// ---------------------------------------------------------------------------

async function getPayroll(companyId, { month } = {}) {
  return run("payroll", companyId, async () => {
    const selectedMonth = month || thisMonthIst();
    const period = `${selectedMonth}-01`;

    const payrolls = await select(
      `SELECT p.uuid, p.base_salary AS "baseSalary", p.lop_deduction AS "lopDeduction", p.bonus,
              p.net_salary AS "netSalary", p.payment_method AS "paymentMethod", p.status,
              p.processed_at AS "processedAt",
              u.first_name AS "firstName", u.last_name AS "lastName", u.email
         FROM payrolls p
         JOIN users u ON u.id = p.user_id
        WHERE p.company_id = :companyId AND p.pay_period = :period
        ORDER BY u.first_name, u.last_name
        LIMIT :limit`,
      { companyId, period, limit: MAX_ROWS },
    );

    const bonuses = await select(
      `SELECT b.uuid, b.bonus_type AS "bonusType", b.amount, b.reason,
              u.first_name AS "firstName", u.last_name AS "lastName", u.email
         FROM employee_bonuses b
         JOIN users u ON u.id = b.user_id
        WHERE b.company_id = :companyId AND b.pay_period = :period
        ORDER BY b.created_at DESC
        LIMIT :limit`,
      { companyId, period, limit: MAX_ROWS },
    );

    const increments = await select(
      `SELECT i.uuid, i.previous_salary AS "previousSalary", i.new_salary AS "newSalary",
              i.effective_date AS "effectiveDate", i.reason,
              u.first_name AS "firstName", u.last_name AS "lastName", u.email
         FROM salary_increments i
         JOIN employees e ON e.id = i.employee_id
         JOIN users u     ON u.id = e.user_id
        WHERE e.company_id = :companyId
        ORDER BY i.id DESC
        LIMIT 100`,
      { companyId },
    );

    const payrollRows = payrolls.map((row) => ({
      uuid: row.uuid,
      employee: { fullName: fullName(row.firstName, row.lastName), email: row.email },
      baseSalary: Number(row.baseSalary),
      lopDeduction: Number(row.lopDeduction),
      bonus: Number(row.bonus),
      netSalary: Number(row.netSalary),
      paymentMethod: row.paymentMethod,
      status: row.status,
      processedAt: row.processedAt,
    }));

    return {
      month: selectedMonth,
      totals: {
        count: payrollRows.length,
        totalNet: payrollRows.reduce((sum, row) => sum + Math.round(row.netSalary * 100), 0) / 100,
        pending: payrollRows.filter((row) => row.status === "Pending").length,
      },
      payrolls: payrollRows,
      bonuses: bonuses.map((row) => ({
        uuid: row.uuid,
        employee: { fullName: fullName(row.firstName, row.lastName), email: row.email },
        bonusType: row.bonusType,
        amount: Number(row.amount),
        reason: row.reason,
      })),
      increments: increments.map((row) => {
        const previous = Number(row.previousSalary);
        const next = Number(row.newSalary);
        return {
          uuid: row.uuid,
          employee: { fullName: fullName(row.firstName, row.lastName), email: row.email },
          previousSalary: previous,
          newSalary: next,
          increasePercent: Math.round(((next - previous) / previous) * 10000) / 100,
          effectiveDate: dateOnly(row.effectiveDate),
          reason: row.reason,
        };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Internship / Probation
// ---------------------------------------------------------------------------

async function getInternshipProbation(companyId) {
  return run("internship/probation", companyId, async () => {
    const today = todayIst();

    const rows = await select(
      `SELECT p.uuid, p.period_type AS "periodType", p.start_date AS "startDate", p.end_date AS "endDate",
              p.original_end_date AS "originalEndDate", p.extension_count AS "extensionCount",
              p.stipend, p.performance, p.status,
              (p.end_date - :today::date) AS "daysLeft",
              u.first_name AS "firstName", u.last_name AS "lastName", u.email
         FROM internship_probation_periods p
         JOIN employees e ON e.id = p.employee_id
         JOIN users u     ON u.id = e.user_id
        WHERE p.company_id = :companyId
        ORDER BY (p.status = 'Active') DESC, p.end_date ASC
        LIMIT :limit`,
      { companyId, today, limit: MAX_ROWS },
    );

    return rows.map((row) => {
      const isActive = row.status === "Active";
      const daysLeft = isActive ? Number(row.daysLeft) : null;
      return {
        uuid: row.uuid,
        employee: { fullName: fullName(row.firstName, row.lastName), email: row.email },
        periodType: row.periodType,
        startDate: dateOnly(row.startDate),
        endDate: dateOnly(row.endDate),
        originalEndDate: dateOnly(row.originalEndDate),
        extensionCount: Number(row.extensionCount),
        stipend: toNumber(row.stipend),
        performance: row.performance,
        status: row.status,
        daysLeft,
        isOverdue: isActive && daysLeft < 0,
        isDueSoon: isActive && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
      };
    });
  });
}

module.exports = {
  getSummary,
  getEmployees,
  getAttendance,
  getLeaves,
  getPayroll,
  getInternshipProbation,
};