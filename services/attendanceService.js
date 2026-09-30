const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const sequelize = require("../config/db");
const User = require("../models/User");

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

    // Always calculate attendance date using India timezone.
    const attendanceDate = getAttendanceDate();

    // Always calculate session using India timezone.
    const session = getAttendanceSession();

    if (!session) {
      throw new Error("Attendance cannot be marked at this time.");
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

    const attendance = await Attendance.create(
      {
        employeeId: employee.id,
        companyId,
        attendanceDate,
        session,

        // This is an actual timestamp.
        // PostgreSQL/Sequelize can store the current instant.
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

module.exports = {
  markAttendance,
  getCompanyTodayAttendance,
};
