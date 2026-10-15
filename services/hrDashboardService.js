const { QueryTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const adminHrmsService = require("./adminHrmsService");

const todayIst = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

const fullName = (firstName, lastName) =>
  [firstName, lastName].filter(Boolean).join(" ");

const dateOnly = (value) =>
  value ? String(value).slice(0, 10) : null;

const select = (sql, replacements) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });

async function getDashboard(companyId) {
  const today = todayIst();
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;

  const [summary, attendance, leaves, periods, extra] = await Promise.all([
    adminHrmsService.getSummary(companyId),
    adminHrmsService.getAttendance(companyId, { date: today }),
    adminHrmsService.getLeaves(companyId, { status: "PENDING" }),
    adminHrmsService.getInternshipProbation(companyId),

    (async () => {
      const [pendingLeaveRows, holidays, joiners, onboarding] =
        await Promise.all([
          select(
            `SELECT l.uuid,
                    u.first_name AS "firstName",
                    u.last_name AS "lastName",
                    l.leave_date AS "leaveDate",
                    l.leave_type AS "leaveType",
                    l.leave_session AS "leaveSession",
                    l.created_at AS "createdAt"
               FROM employee_leaves l
               JOIN employees e ON e.id = l.employee_id
               JOIN users u ON u.id = e.user_id
              WHERE l.company_id = :companyId
                AND l.leave_status = 'PENDING'
              ORDER BY l.created_at DESC, l.id DESC
              LIMIT 5`,
            { companyId },
          ),

          select(
            `SELECT uuid, name, holiday_date AS "holidayDate", is_paid AS "isPaid"
               FROM company_holidays
              WHERE company_id = :companyId
                AND holiday_date >= :today
              ORDER BY holiday_date ASC
              LIMIT 3`,
            { companyId, today },
          ),

          select(
            `SELECT e.uuid, u.first_name AS "firstName",
                    u.last_name AS "lastName", e.joining_date AS "joiningDate",
                    e.employment_type AS "employmentType"
               FROM employees e
               JOIN users u ON u.id = e.user_id
              WHERE e.company_id = :companyId
                AND e.joining_date >= :monthStart
                AND e.joining_date < (:monthStart::date + INTERVAL '1 month')
              ORDER BY e.joining_date DESC, u.first_name ASC
              LIMIT 5`,
            { companyId, monthStart },
          ),

          select(
            `SELECT
                COUNT(*)::int AS "inProgress",
                COUNT(*) FILTER (
                  WHERE e.joining_date >= :monthStart
                    AND e.joining_date < (:monthStart::date + INTERVAL '1 month')
                )::int AS "joinedThisMonth"
               FROM employees e
               LEFT JOIN employee_onboarding o
                 ON o.employee_id = e.id
                AND o.company_id = e.company_id
              WHERE e.company_id = :companyId
                AND e.employment_status <> 'Exited'
                AND o.id IS NOT NULL
                AND o.completed_at IS NULL`,
            { companyId, monthStart },
          ),
        ]);

      const [joinerCount] = await select(
        `SELECT COUNT(*)::int AS count
           FROM employees
          WHERE company_id = :companyId
            AND joining_date >= :monthStart
            AND joining_date < (:monthStart::date + INTERVAL '1 month')`,
        { companyId, monthStart },
      );

      return {
        pendingLeaveRows,
        holidays,
        joiners,
        joinerCount: Number(joinerCount.count),
        onboardingInProgress: Number(onboarding[0]?.inProgress || 0),
      };
    })(),
  ]);

  const attendanceCounts = {
    present: 0,
    halfDay: 0,
    onLeave: 0,
    notMarked: 0,
  };

  for (const record of attendance.records) {
    switch (record.dayStatus) {
      case "Present":
        attendanceCounts.present += 1;
        break;
      case "Half Day":
        attendanceCounts.halfDay += 1;
        break;
      case "On Leave":
        attendanceCounts.onLeave += 1;
        break;
      case "Not Marked":
        attendanceCounts.notMarked += 1;
        break;
      default:
        break;
    }
  }

  const activeAlerts = periods.filter(
    (period) => period.isOverdue || period.isDueSoon,
  );

  const employeeCounts = summary.employees;

  return {
    date: today,

    cards: {
      activeEmployees: Number(employeeCounts.total),
      fullTime: Number(employeeCounts.fullTime),
      interns: Number(employeeCounts.interns),
      probation: Number(employeeCounts.probation),
      presentToday: Number(summary.today.presentToday),
      onLeaveToday: Number(summary.today.onLeaveToday),
      pendingLeaveRequests: Number(summary.today.pendingLeaves),
    },

    attendance: {
      ...attendanceCounts,
      total: attendance.records.length,
    },

    pendingLeaves: extra.pendingLeaveRows.map((row) => ({
      uuid: row.uuid,
      employeeName: fullName(row.firstName, row.lastName),
      leaveDate: dateOnly(row.leaveDate),
      leaveType: row.leaveType,
      leaveSession: row.leaveSession,
      createdAt: row.createdAt,
    })),

    internshipProbationAlerts: activeAlerts.map((period) => ({
      uuid: period.uuid,
      employeeName: period.employee.fullName,
      periodType: period.periodType,
      endDate: period.endDate,
      daysLeft: period.daysLeft,
      isOverdue: period.isOverdue,
      isDueSoon: period.isDueSoon,
    })),

    payroll: {
      month: summary.payroll.month,
      processed: Number(summary.payroll.processed),
      pending: Number(summary.payroll.pending),
      totalNet: Number(summary.payroll.totalNet),
    },

    upcomingHolidays: extra.holidays.map((holiday) => ({
      uuid: holiday.uuid,
      name: holiday.name,
      date: dateOnly(holiday.holidayDate),
      isPaid: holiday.isPaid,
    })),

    onboarding: {
      joinedThisMonth: extra.joinerCount,
      inProgress: extra.onboardingInProgress,
      newJoiners: extra.joiners.map((employee) => ({
        uuid: employee.uuid,
        fullName: fullName(employee.firstName, employee.lastName),
        joiningDate: dateOnly(employee.joiningDate),
        employmentType: employee.employmentType,
      })),
    },
  };
}

module.exports = { getDashboard };