const { Op } = require("@sequelize/core");

const sequelize = require("../config/db");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const EmployeeLeave = require("../models/EmployeeLeave");
const CompanyHoliday = require("../models/CompanyHoliday");

const INDIA_TIMEZONE = "Asia/Kolkata";

const VALID_SESSIONS = new Set(["FIRST_HALF", "SECOND_HALF"]);

const VALID_STATUSES = new Set(["Present", "Absent"]);

// -----------------------------------------------------------------------------
// Date and session helpers
// -----------------------------------------------------------------------------

function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
  };
}

function getApplicableSessions(weekday) {
  if (weekday === "Sun") return [];

  if (weekday === "Sat") {
    return ["FIRST_HALF"];
  }

  return ["FIRST_HALF", "SECOND_HALF"];
}

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// -----------------------------------------------------------------------------
// Leave helpers
// -----------------------------------------------------------------------------

function getLeaveForSession(leaves, session) {
  return (
    leaves.find(
      (leave) =>
        leave.leaveStatus === "APPROVED" &&
        (leave.leaveSession === "FULL_DAY" || leave.leaveSession === session),
    ) || null
  );
}

// -----------------------------------------------------------------------------
// Employee attendance response serializer
// -----------------------------------------------------------------------------

function serializeEmployee(
  employee,
  attendanceBySession,
  leaves,
  applicableSessions,
  holiday,
  weekday,
) {
  const user = employee.user;
  const sessions = {};

  for (const session of ["FIRST_HALF", "SECOND_HALF"]) {
    if (!applicableSessions.includes(session)) {
      sessions[session] = {
        applicable: false,
        status:
          weekday === "Sat" && session === "SECOND_HALF"
            ? "NOT_APPLICABLE"
            : "WEEKLY_OFF",
        attendanceUuid: null,
        checkIn: null,
        leave: null,
        canMark: false,
      };

      continue;
    }

    const attendance = attendanceBySession[session];
    const leave = getLeaveForSession(leaves, session);

    let status = "NOT_MARKED";
    let canMark = true;

    if (holiday) {
      status = "HOLIDAY";
      canMark = false;
    } else if (leave) {
      status = "ON_LEAVE";
      canMark = false;
    } else if (attendance) {
      status = attendance.status === "Present" ? "PRESENT" : "ABSENT";

      canMark = false;
    }

    sessions[session] = {
      applicable: true,
      status,
      attendanceUuid: attendance?.uuid || null,
      checkIn: attendance?.checkIn || null,
      leave: leave
        ? {
            uuid: leave.uuid,
            leaveType: leave.leaveType,
            leaveSession: leave.leaveSession,
            leaveStatus: leave.leaveStatus,
            isPaid: leave.isPaid,
          }
        : null,
      canMark,
    };
  }

  return {
    id: employee.id,
    uuid: employee.uuid,
    userId: employee.userId,
    employeeCode: employee.employeeCode ?? employee.employee_code ?? null,
    name:
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
      "Unknown Employee",
    email: user?.email || employee.companyEmail || null,

    // Compatibility fields for the frontend.
    firstHalf: sessions.FIRST_HALF.status,
    secondHalf: sessions.SECOND_HALF.status,

    sessions,
  };
}

// -----------------------------------------------------------------------------
// GET today's manual attendance for the company
// -----------------------------------------------------------------------------

async function getManualAttendanceToday(companyId) {
  if (!companyId) {
    throw createError("Company ID is required.", 400);
  }

  const { date: attendanceDate, weekday } = getIndiaDateParts();

  const applicableSessions = getApplicableSessions(weekday);

  const [holiday, employees, attendanceRecords, leaveRecords] =
    await Promise.all([
      CompanyHoliday.findOne({
        where: {
          companyId,
          holidayDate: attendanceDate,
        },
      }),

      Employee.findAll({
        where: {
          companyId,
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "uuid", "firstName", "lastName", "email"],
            required: false,
          },
        ],
        order: [["id", "ASC"]],
      }),

      Attendance.findAll({
        where: {
          companyId,
          attendanceDate,
        },
      }),

      EmployeeLeave.findAll({
        where: {
          companyId,
          leaveDate: attendanceDate,
          leaveStatus: "APPROVED",
        },
      }),
    ]);

  const attendanceMap = new Map();

  for (const record of attendanceRecords) {
    if (!attendanceMap.has(record.employeeId)) {
      attendanceMap.set(record.employeeId, {});
    }

    attendanceMap.get(record.employeeId)[record.session] = record;
  }

  const leaveMap = new Map();

  for (const leave of leaveRecords) {
    if (!leaveMap.has(leave.employeeId)) {
      leaveMap.set(leave.employeeId, []);
    }

    leaveMap.get(leave.employeeId).push(leave);
  }

  const serializedEmployees = employees.map((employee) =>
    serializeEmployee(
      employee,
      attendanceMap.get(employee.id) || {},
      leaveMap.get(employee.id) || [],
      applicableSessions,
      holiday,
      weekday,
    ),
  );

  return {
    date: attendanceDate,
    timezone: INDIA_TIMEZONE,
    weekday,
    isHoliday: Boolean(holiday),

    holiday: holiday
      ? {
          uuid: holiday.uuid,
          name: holiday.name,
          isPaid: holiday.isPaid,
        }
      : null,

    isWeekend: weekday === "Sun",
    applicableSessions,
    employees: serializedEmployees,
  };
}

// -----------------------------------------------------------------------------
// Mark manual attendance as Present or Absent
// -----------------------------------------------------------------------------

async function markManualAttendance({
  companyId,
  employeeId,
  session,
  status,
}) {
  if (!companyId) {
    throw createError("Company ID is required.", 400);
  }

  const numericEmployeeId = Number(employeeId);

  if (!Number.isInteger(numericEmployeeId) || numericEmployeeId <= 0) {
    throw createError("A valid employeeId is required.", 400);
  }

  if (!VALID_SESSIONS.has(session)) {
    throw createError("Session must be FIRST_HALF or SECOND_HALF.", 400);
  }

  if (!VALID_STATUSES.has(status)) {
    throw createError("Status must be Present or Absent.", 400);
  }

  const { date: attendanceDate, weekday } = getIndiaDateParts();

  const applicableSessions = getApplicableSessions(weekday);

  if (!applicableSessions.includes(session)) {
    throw createError(
      weekday === "Sun"
        ? "Attendance cannot be marked on Sunday."
        : "Only first-half attendance is applicable on Saturday.",
      409,
    );
  }

  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    // Verify the employee belongs to the authenticated company.
    const employee = await Employee.findOne({
      where: {
        id: numericEmployeeId,
        companyId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!employee) {
      throw createError("Employee not found in this company.", 404);
    }

    // Company holiday blocks attendance for all employees.
    const holiday = await CompanyHoliday.findOne({
      where: {
        companyId,
        holidayDate: attendanceDate,
      },
      transaction,
    });

    if (holiday) {
      throw createError(`Today is a company holiday: ${holiday.name}.`, 409);
    }

    // Only approved leave for the relevant session blocks attendance.
    const leave = await EmployeeLeave.findOne({
      where: {
        employeeId: numericEmployeeId,
        companyId,
        leaveDate: attendanceDate,
        leaveStatus: "APPROVED",
        [Op.or]: [{ leaveSession: "FULL_DAY" }, { leaveSession: session }],
      },
      transaction,
    });

    if (leave) {
      const leaveLabel = leave.leaveSession.toLowerCase().replace("_", "-");

      throw createError(
        `Attendance cannot be marked because the employee has approved ${leaveLabel} leave.`,
        409,
      );
    }

    // Prevent duplicate attendance for the same session.
    const existing = await Attendance.findOne({
      where: {
        employeeId: numericEmployeeId,
        companyId,
        attendanceDate,
        session,
      },
      transaction,
    });

    if (existing) {
      throw createError(
        `${session === "FIRST_HALF" ? "First" : "Second"}-half attendance has already been marked.`,
        409,
      );
    }

    // Save the status requested by HR.
    const attendance = await Attendance.create(
      {
        employeeId: numericEmployeeId,
        companyId,
        attendanceDate,
        session,
        checkIn: new Date(),
        status,
      },
      { transaction },
    );

    await transaction.commit();

    return attendance;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    // Convert concurrent duplicate inserts into a conflict response.
    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "23505"
    ) {
      throw createError(
        "Attendance has already been marked for this employee and session.",
        409,
      );
    }

    throw error;
  }
}

module.exports = {
  getManualAttendanceToday,
  markManualAttendance,
};
