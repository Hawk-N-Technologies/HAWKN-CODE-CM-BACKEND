const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const sequelize = require("../config/db");
const User = require("../models/User");
const { Op } = require("@sequelize/core");
const logger = require("../utils/logger");
const EmployeeLeave = require("../models/EmployeeLeave");
const CompanyHoliday = require("../models/CompanyHoliday");

const INDIA_TIMEZONE = "Asia/Kolkata";

function getIndiaDateParts() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function getAttendanceDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getAttendanceSession() {
  const { hour, minute, weekday } = getIndiaDateParts();

  const currentMinutes = hour * 60 + minute;

  const firstHalfStart = 10 * 60; // 10:00
  const firstHalfEnd = 14 * 60; // 14:00

  const secondHalfStart = 14 * 60; // 14:00
  const secondHalfEnd = 18 * 60; // 18:00

  // Sunday
  if (weekday === "Sun") {
    return null;
  }

  // Saturday - first half only
  if (weekday === "Sat") {
    if (currentMinutes >= firstHalfStart && currentMinutes < firstHalfEnd) {
      return "FIRST_HALF";
    }

    return null;
  }

  // Monday - Friday
  if (currentMinutes >= firstHalfStart && currentMinutes < firstHalfEnd) {
    return "FIRST_HALF";
  }

  if (currentMinutes >= secondHalfStart && currentMinutes < secondHalfEnd) {
    return "SECOND_HALF";
  }

  return null;
}

async function markAttendance(userId, companyId) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const employee = await Employee.findOne({
      where: {
        userId,
        companyId,
      },
      transaction,
    });

    if (!employee) {
      throw new Error("Employee not found.");
    }

    const attendanceDate = getAttendanceDate();
    const session = getAttendanceSession();

    if (!session) {
      throw new Error("Attendance cannot be marked at this time.");
    }

    const holiday = await CompanyHoliday.findOne({
      where: {
        companyId,
        holiday_date: attendanceDate,
      },
      transaction,
    });

    if (holiday) {
      throw new Error(
        `Attendance cannot be marked because today is a holiday: ${
          holiday.name || "Holiday"
        }.`,
      );
    }

    const leave = await EmployeeLeave.findOne({
      where: {
        employeeId: employee.id,
        companyId,
        leaveDate: attendanceDate,
        leaveStatus: "APPROVED",
        [Op.or]: [{ leaveSession: "FULL_DAY" }, { leaveSession: session }],
      },
      transaction,
    });

    if (leave) {
      if (leave.leaveSession === "FULL_DAY") {
        throw new Error(
          "Attendance cannot be marked because you are on full-day leave today.",
        );
      }

      if (leave.leaveSession === "FIRST_HALF") {
        throw new Error(
          "Attendance cannot be marked because you are on first-half leave.",
        );
      }

      if (leave.leaveSession === "SECOND_HALF") {
        throw new Error(
          "Attendance cannot be marked because you are on second-half leave.",
        );
      }
    }

    const existingAttendance = await Attendance.findOne({
      where: {
        employeeId: employee.id,
        companyId,
        attendanceDate,
        session,
      },
      transaction,
    });

    if (existingAttendance) {
      throw new Error(
        `${
          session === "FIRST_HALF" ? "First" : "Second"
        } half attendance has already been marked.`,
      );
    }

    console.log("CHECK-IN NOW:", new Date().toISOString());

    console.log(
      "CHECK-IN IST:",
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "full",
        timeStyle: "long",
      }).format(new Date()),
    );

    const attendance = await Attendance.create(
      {
        employeeId: employee.id,
        companyId,
        attendanceDate,
        session,
        checkIn: new Date(),
        status: "Present",
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return attendance;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function getCompanyTodayAttendance(companyId) {
  const attendanceDate = getAttendanceDate();

  const attendance = await Attendance.findAll({
    where: {
      companyId,
      attendanceDate,
    },
    include: [
      {
        model: Employee,
        as: "employee",
        attributes: [
          "id",
          "uuid",
          "userId",
          "companyId",
          "companyEmail",
          "phone1",
          "employmentType",
          "employmentStatus",
        ],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "uuid", "firstName", "lastName", "email"],
          },
        ],
      },
    ],
    order: [["checkIn", "ASC"]],
  });

  return attendance;
}

async function getAttendanceHistory(companyId, options = {}) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const { page = 1, limit = 10, from, to, search = "", employeeId } = options;

    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const offset = (parsedPage - 1) * parsedLimit;

    const where = {
      companyId: Number(companyId),
    };

    if (from || to) {
      where.attendanceDate = {};

      if (from) {
        where.attendanceDate[Op.gte] = from;
      }

      if (to) {
        where.attendanceDate[Op.lte] = to;
      }
    }

    if (employeeId) {
      where.employeeId = Number(employeeId);
    }

    const trimmedSearch = typeof search === "string" ? search.trim() : "";

    const employeeInclude = {
      model: Employee,
      as: "employee",
      required: false,
      include: [
        {
          model: User,
          as: "user",
          required: false,
          attributes: ["id", "uuid", "firstName", "lastName", "email"],
        },
      ],
    };

    if (trimmedSearch) {
      employeeInclude.required = true;
      employeeInclude.include[0].required = true;

      employeeInclude.include[0].where = {
        [Op.or]: [
          {
            firstName: {
              [Op.iLike]: `%${trimmedSearch}%`,
            },
          },
          {
            lastName: {
              [Op.iLike]: `%${trimmedSearch}%`,
            },
          },
          {
            email: {
              [Op.iLike]: `%${trimmedSearch}%`,
            },
          },
        ],
      };
    }

    console.log("ATTENDANCE HISTORY OPTIONS:", {
      from,
      to,
      employeeId,
      search: trimmedSearch,
    });

    console.log("ATTENDANCE WHERE:", where);

    const { rows, count } = await Attendance.findAndCountAll({
      where,
      include: [employeeInclude],

      order: [
        ["attendanceDate", "DESC"],
        ["session", "ASC"],
        ["id", "DESC"],
      ],

      limit: parsedLimit,
      offset,
      distinct: true,
    });

    const records = rows.map((row) => row.toJSON());

    const totalPages = Math.ceil(count / parsedLimit);

    return {
      records,

      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total: count,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1,
      },

      filters: {
        from: from || null,
        to: to || null,
        search: trimmedSearch,
        employeeId: employeeId || null,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch attendance history", {
      companyId,
      options,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

const pad = (value) => String(value).padStart(2, "0");

const formatDate = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
};

const getMonthRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1);

  const endDate = new Date(year, month, 0);

  return {
    startDate,
    endDate,
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
};

const getDayOfWeek = (date) => {
  return date.getDay();
};

const buildAttendanceMap = (records) => {
  const map = new Map();

  for (const record of records) {
    const date = record.attendanceDate;

    if (!map.has(date)) {
      map.set(date, {});
    }

    map.get(date)[record.session] = {
      status: record.status,
      checkIn: record.checkIn,
      uuid: record.uuid,
    };
  }

  return map;
};


const buildLeaveMap = (leaves) => {
  const map = new Map();

  for (const leave of leaves) {
    /*
     * Rejected leave should not affect attendance.
     */
    if (leave.leaveStatus === "REJECTED") {
      continue;
    }

    const date = leave.leaveDate;

    if (!map.has(date)) {
      map.set(date, []);
    }

    map.get(date).push({
      uuid: leave.uuid,
      type: leave.leaveType,
      session: leave.leaveSession,
      status: leave.leaveStatus,
      isPaid: leave.isPaid,
      reason: leave.reason,
    });
  }

  return map;
};

const buildHolidayMap = (holidays) => {
  const map = new Map();

  for (const holiday of holidays) {
    map.set(holiday.holidayDate, {
      uuid: holiday.uuid,
      name: holiday.name,
      isPaid: holiday.isPaid,
    });
  }

  return map;
};

const findLeaveForSession = (leaves, session) => {
  if (!leaves?.length) {
    return null;
  }

  return (
    leaves.find(
      (leave) => leave.session === "FULL_DAY" || leave.session === session,
    ) || null
  );
};

/**
 * Resolve one half of one working day.
 */
const resolveSession = ({ date, session, attendance, leaves, holiday }) => {
  /*
   * Sunday
   */
  if (date.getDay() === 0) {
    return {
      type: "WEEKEND",
      status: "Weekend",
      session,
      isPaid: false,
      checkIn: null,
      attendanceUuid: null,
      leave: null,
      holiday: null,
    };
  }

  /*
   * Saturday only has FIRST_HALF.
   *
   * SECOND_HALF is not applicable.
   */
  if (date.getDay() === 6 && session === "SECOND_HALF") {
    return null;
  }

  /*
   * Company holiday takes precedence.
   */
  if (holiday) {
    return {
      type: "HOLIDAY",
      status: "Holiday",
      session,
      isPaid: holiday.isPaid,
      checkIn: null,
      attendanceUuid: null,
      leave: null,
      holiday,
    };
  }

  /*
   * Approved/pending leave.
   *
   * Pending leave is returned as Leave Pending,
   * but payroll should NOT count it as approved leave.
   */
  const leave = findLeaveForSession(leaves, session);

  if (leave) {
    const isApproved = leave.status === "APPROVED";

    return {
      type: "LEAVE",
      status: isApproved
        ? leave.isPaid === false
          ? "Unpaid Leave"
          : "Paid Leave"
        : "Leave Pending",
      session,
      isPaid: isApproved ? leave.isPaid : null,
      checkIn: null,
      attendanceUuid: null,
      leave,
      holiday: null,
    };
  }

  /*
   * Actual attendance.
   */
  const attendanceRecord = attendance?.[session];

  if (attendanceRecord) {
    return {
      type: "ATTENDANCE",
      status: attendanceRecord.status,
      session,
      isPaid: attendanceRecord.status === "Present",
      checkIn: attendanceRecord.checkIn,
      attendanceUuid: attendanceRecord.uuid,
      leave: null,
      holiday: null,
    };
  }

  /*
   * No attendance, leave or holiday.
   *
   * For a working day this means Absent.
   */
  return {
    type: "ATTENDANCE",
    status: "Absent",
    session,
    isPaid: false,
    checkIn: null,
    attendanceUuid: null,
    leave: null,
    holiday: null,
  };
};

const getEmployeeMonthlyAttendance = async ({ userId, year, month }) => {
  const numericUserId = Number(userId);
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
    throw new Error("Invalid userId.");
  }

  if (
    !Number.isInteger(numericYear) ||
    numericYear < 2000 ||
    numericYear > 2100
  ) {
    throw new Error("Invalid year.");
  }

  if (
    !Number.isInteger(numericMonth) ||
    numericMonth < 1 ||
    numericMonth > 12
  ) {
    throw new Error("Invalid month.");
  }

  const { startDate, endDate, start, end } = getMonthRange(
    numericYear,
    numericMonth,
  );

  /*
   * Employee belongs to the user.
   */
  const employee = await Employee.findOne({
    where: {
      userId: numericUserId,
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "uuid", "firstName", "lastName", "email"],
      },
    ],
  });

  if (!employee) {
    const error = new Error("Employee profile not found.");
    error.statusCode = 404;
    throw error;
  }

  /*
   * Attendance
   */
  const attendanceRecords = await Attendance.findAll({
    where: {
      employeeId: employee.id,
      attendanceDate: {
        [Op.between]: [start, end],
      },
    },
    order: [
      ["attendanceDate", "ASC"],
      ["session", "ASC"],
    ],
  });

  /*
   * Leaves
   */
  const leaves = await EmployeeLeave.findAll({
    where: {
      employeeId: employee.id,
      leaveDate: {
        [Op.between]: [start, end],
      },
    },
    order: [["leaveDate", "ASC"]],
  });

  /*
   * Company holidays
   */
  const holidays = await CompanyHoliday.findAll({
    where: {
      companyId: employee.companyId,
      holidayDate: {
        [Op.between]: [start, end],
      },
    },
    order: [["holidayDate", "ASC"]],
  });

  const attendanceMap = buildAttendanceMap(attendanceRecords);
  const leaveMap = buildLeaveMap(leaves);
  const holidayMap = buildHolidayMap(holidays);

  const days = [];

  /*
   * Generate every calendar day.
   */
  for (
    let current = new Date(startDate);
    current <= endDate;
    current.setDate(current.getDate() + 1)
  ) {
    const date = new Date(current);

    const dateString = formatDate(date);
    const dayOfWeek = getDayOfWeek(date);

    const attendance = attendanceMap.get(dateString) || {};
    const dayLeaves = leaveMap.get(dateString) || [];
    const holiday = holidayMap.get(dateString) || null;

    /*
     * Sunday
     */
    if (dayOfWeek === 0) {
      days.push({
        date: dateString,
        day: date.toLocaleDateString("en-IN", {
          weekday: "long",
        }),
        dayNumber: date.getDate(),
        isWeekend: true,
        isSaturday: false,
        isSunday: true,
        holiday: null,
        sessions: {
          firstHalf: {
            type: "WEEKEND",
            status: "Weekend",
            session: "FIRST_HALF",
            isPaid: false,
            checkIn: null,
          },
          secondHalf: {
            type: "WEEKEND",
            status: "Weekend",
            session: "SECOND_HALF",
            isPaid: false,
            checkIn: null,
          },
        },
        overallStatus: "Weekend",
      });

      continue;
    }

    /*
     * Saturday = FIRST_HALF only.
     */
    const firstHalf = resolveSession({
      date,
      session: "FIRST_HALF",
      attendance,
      leaves: dayLeaves,
      holiday,
    });

    let secondHalf = null;

    if (dayOfWeek !== 6) {
      secondHalf = resolveSession({
        date,
        session: "SECOND_HALF",
        attendance,
        leaves: dayLeaves,
        holiday,
      });
    }

    /*
     * Calculate a user-friendly overall status.
     */
    let overallStatus = "Present";

    const statuses = [firstHalf?.status, secondHalf?.status].filter(Boolean);

    if (statuses.every((status) => status === "Holiday")) {
      overallStatus = "Holiday";
    } else if (
      statuses.some(
        (status) => status === "Unpaid Leave" || status === "Paid Leave",
      )
    ) {
      const hasUnpaidLeave = statuses.includes("Unpaid Leave");

      overallStatus = hasUnpaidLeave ? "Unpaid Leave" : "Paid Leave";
    } else if (statuses.includes("Leave Pending")) {
      overallStatus = "Leave Pending";
    } else if (statuses.includes("Absent")) {
      if (statuses.every((status) => status === "Absent")) {
        overallStatus = "Absent";
      } else {
        overallStatus = "Half Day";
      }
    } else if (statuses.every((status) => status === "Present")) {
      overallStatus = "Present";
    } else if (dayOfWeek === 6) {
      /*
       * Saturday is only one working half.
       */
      overallStatus = firstHalf?.status || "—";
    }

    days.push({
      date: dateString,
      day: date.toLocaleDateString("en-IN", {
        weekday: "long",
      }),
      dayNumber: date.getDate(),

      isWeekend: false,
      isSaturday: dayOfWeek === 6,
      isSunday: false,

      holiday,

      sessions: {
        firstHalf,
        secondHalf,
      },

      overallStatus,
    });
  }

  /*
   * Monthly summary.
   */
  const summary = {
    totalDays: days.length,
    workingDays: 0,
    presentUnits: 0,
    absentUnits: 0,
    paidLeaveUnits: 0,
    unpaidLeaveUnits: 0,
    paidHolidayUnits: 0,
    unpaidHolidayUnits: 0,
    leavePendingUnits: 0,
    weekendDays: 0,
  };

  for (const day of days) {
    if (day.isSunday) {
      summary.weekendDays += 1;
      continue;
    }

    const sessions = [day.sessions.firstHalf, day.sessions.secondHalf].filter(
      Boolean,
    );

    /*
     * A normal weekday has 2 units.
     * Saturday has 1 unit.
     */
    summary.workingDays += sessions.length;

    for (const session of sessions) {
      switch (session.status) {
        case "Present":
          summary.presentUnits += 1;
          break;

        case "Absent":
          summary.absentUnits += 1;
          break;

        case "Paid Leave":
          summary.paidLeaveUnits += 1;
          break;

        case "Unpaid Leave":
          summary.unpaidLeaveUnits += 1;
          break;

        case "Paid Holiday":
          summary.paidHolidayUnits += 1;
          break;

        case "Unpaid Holiday":
          summary.unpaidHolidayUnits += 1;
          break;

        case "Leave Pending":
          summary.leavePendingUnits += 1;
          break;

        default:
          break;
      }
    }
  }

  return {
    employee: {
      id: employee.id,
      uuid: employee.uuid,
      userId: employee.userId,
      companyId: employee.companyId,
      firstName: employee.user?.firstName || "",
      lastName: employee.user?.lastName || "",
      fullName: `${employee.user?.firstName || ""} ${
        employee.user?.lastName || ""
      }`.trim(),
      email: employee.user?.email || employee.companyEmail || null,
      joiningDate: employee.joiningDate,
    },

    month: numericMonth,
    year: numericYear,

    period: {
      startDate: start,
      endDate: end,
    },

    summary,

    days,
  };
};

module.exports = {
  markAttendance,
  getCompanyTodayAttendance,
  getAttendanceHistory,
  getEmployeeMonthlyAttendance,
};
