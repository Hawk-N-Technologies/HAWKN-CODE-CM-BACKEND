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

module.exports = {
  markAttendance,
  getCompanyTodayAttendance,
  getAttendanceHistory,
};
