const { QueryTypes, UniqueConstraintError } = require("@sequelize/core");
const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");
const {
  EmployeeSalary,
  EmployeeLeave,
  User,
  Attendance,
  Employee,
} = require("../models/associations");
const logger = require("../utils/logger");
const CompanyHoliday = require("../models/CompanyHoliday");

const MAX_LIST_ROWS = 500; // safety cap until the table gets pagination

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Money in whole paise — avoids floating-point rounding errors
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;
const roundNumber = (value) => Number(Number(value).toFixed(2));

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
        replacements: {
          companyId,
          userUuid: userUuid ?? null,
          limit: MAX_LIST_ROWS,
        },
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
        {
          replacements: { userUuid, companyId },
          type: QueryTypes.SELECT,
          transaction,
        },
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

      await EmployeeSalary.create(
        { employeeId: employee.id, salary: amount },
        { transaction },
      );
      return { created: true };
    });

    logger.info(result.created ? "Salary created" : "Salary updated", {
      companyId,
      userUuid,
    });

    const [row] = await listSalaries(companyId, { userUuid });
    return { record: row, created: result.created };
  } catch (error) {
    // Two HR users setting the same employee's salary at the same moment
    if (error instanceof UniqueConstraintError) {
      throw httpError(
        409,
        "Salary for this employee was just set by someone else — refresh and try again",
      );
    }

    logger.error("Failed to set salary", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

const roundUnit = (value) => Number(Number(value || 0).toFixed(2));

const formatDate = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value.substring(0, 10);
  }

  return new Date(value).toISOString().substring(0, 10);
};

const getMonthRange = (payPeriod) => {
  if (!payPeriod) {
    throw new Error("Pay period is required");
  }

  // Accept:
  // 2026-09
  // 2026-09-01
  const match = String(payPeriod).match(/^(\d{4})-(\d{2})/);

  if (!match) {
    throw new Error("Pay period must be in YYYY-MM format");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error("Invalid pay period month");
  }

  const start = new Date(Date.UTC(year, month - 1, 1));

  const end = new Date(Date.UTC(year, month, 1));

  return {
    year,
    month,
    start,
    end,
    startDate: formatDate(start),
    endDate: formatDate(end),
    payPeriod: `${year}-${String(month).padStart(2, "0")}-01`,
  };
};

// ---------------------------------------------------------------------------
// Find employee + salary
// ---------------------------------------------------------------------------

const getEmployeeWithSalary = async ({ companyId, userUuid }) => {
  const user = await User.findOne({
    where: {
      uuid: userUuid,
      companyId,
    },
    include: [
      {
        model: Employee,
        as: "employee",
        required: true,

        include: [
          {
            model: EmployeeSalary,
            as: "salary",
            required: true,
          },
        ],
      },
    ],
  });

  if (!user) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }

  if (!user.employee) {
    const error = new Error("Employee record not found");
    error.statusCode = 404;
    throw error;
  }

  if (!user.employee.salary) {
    const error = new Error(
      "Salary structure is not configured for this employee",
    );

    error.statusCode = 400;
    throw error;
  }

  return {
    user,
    employee: user.employee,
    salary: user.employee.salary,
  };
};

// ---------------------------------------------------------------------------
// Get attendance
// ---------------------------------------------------------------------------

const getEmployeeAttendance = async ({
  companyId,
  employeeId,
  startDate,
  endDate,
}) => {
  return Attendance.findAll({
    where: {
      companyId,
      employeeId,
      attendanceDate: {
        [Op.gte]: startDate,
        [Op.lt]: endDate,
      },
    },

    order: [
      ["attendanceDate", "ASC"],
      ["session", "ASC"],
    ],
  });
};

// ---------------------------------------------------------------------------
// Get approved leaves
// ---------------------------------------------------------------------------

const getEmployeeLeaves = async ({
  companyId,
  employeeId,
  startDate,
  endDate,
}) => {
  return EmployeeLeave.findAll({
    where: {
      companyId,
      employeeId,
      leaveDate: {
        [Op.gte]: startDate,
        [Op.lt]: endDate,
      },

      // Pending/rejected leaves must NOT affect payroll.
      leaveStatus: "APPROVED",
    },

    order: [["leaveDate", "ASC"]],
  });
};

// ---------------------------------------------------------------------------
// Get company holidays
// ---------------------------------------------------------------------------

const getCompanyHolidays = async ({ companyId, startDate, endDate }) => {
  return CompanyHoliday.findAll({
    where: {
      companyId,
      holidayDate: {
        [Op.gte]: startDate,
        [Op.lt]: endDate,
      },
    },

    order: [["holidayDate", "ASC"]],
  });
};

// ---------------------------------------------------------------------------
// Build maps
// ---------------------------------------------------------------------------

const buildAttendanceMap = (attendances) => {
  const map = new Map();

  for (const attendance of attendances) {
    const date = formatDate(attendance.attendanceDate);

    if (!map.has(date)) {
      map.set(date, {});
    }

    map.get(date)[attendance.session] = attendance.status;
  }

  return map;
};

const buildLeaveMap = (leaves) => {
  const map = new Map();

  for (const leave of leaves) {
    const date = formatDate(leave.leaveDate);

    if (!map.has(date)) {
      map.set(date, []);
    }

    map.get(date).push(leave);
  }

  return map;
};

const buildHolidayMap = (holidays) => {
  const map = new Map();

  for (const holiday of holidays) {
    const date = formatDate(holiday.holidayDate);

    map.set(date, {
      name: holiday.name,
      isPaid: holiday.isPaid,
    });
  }

  return map;
};

// ---------------------------------------------------------------------------
// Calculate payroll
// ---------------------------------------------------------------------------

const calculatePayroll = async ({ companyId, userUuid, payPeriod }) => {
  const {
    startDate,
    endDate,
    payPeriod: normalizedPayPeriod,
  } = getMonthRange(payPeriod);

  // ---------------------------------------------------------
  // Employee + salary
  // ---------------------------------------------------------

  const { user, employee, salary } = await getEmployeeWithSalary({
    companyId,
    userUuid,
  });

  const baseSalary = Number(salary.salary);

  // ---------------------------------------------------------
  // Records
  // ---------------------------------------------------------

  const [attendances, leaves, holidays] = await Promise.all([
    getEmployeeAttendance({
      companyId,
      employeeId: employee.id,
      startDate,
      endDate,
    }),

    getEmployeeLeaves({
      companyId,
      employeeId: employee.id,
      startDate,
      endDate,
    }),

    getCompanyHolidays({
      companyId,
      startDate,
      endDate,
    }),
  ]);

  const attendanceMap = buildAttendanceMap(attendances);

  const leaveMap = buildLeaveMap(leaves);

  const holidayMap = buildHolidayMap(holidays);

  // ---------------------------------------------------------
  // First calculate total working units
  //
  // Monday-Friday = 1
  // Saturday = 0.5
  // Sunday = 0
  //
  // Paid holiday = 0
  // Unpaid holiday = its normal working unit
  // ---------------------------------------------------------

  let workingUnits = 0;

  const days = [];

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  for (
    let date = new Date(start);
    date < end;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const current = new Date(date);

    const dateString = formatDate(current);

    const dayOfWeek = current.getUTCDay();

    // Sunday
    if (dayOfWeek === 0) {
      days.push({
        date: dateString,
        dayOfWeek,
        type: "WEEKLY_OFF",
        workingUnits: 0,
      });

      continue;
    }

    const normalUnits = dayOfWeek === 6 ? 0.5 : 1;

    const holiday = holidayMap.get(dateString);

    // Paid holiday
    if (holiday?.isPaid) {
      days.push({
        date: dateString,
        dayOfWeek,
        type: "PAID_HOLIDAY",
        holidayName: holiday.name,
        workingUnits: 0,
      });

      continue;
    }

    // Unpaid holiday is still a payable/LOP working unit.
    workingUnits += normalUnits;

    days.push({
      date: dateString,
      dayOfWeek,
      type:
        dayOfWeek === 6
          ? "SATURDAY"
          : holiday
            ? "UNPAID_HOLIDAY"
            : "WORKING_DAY",
      holidayName: holiday?.name,
      workingUnits: normalUnits,
    });
  }

  if (workingUnits <= 0) {
    throw new Error("No working days found for this pay period");
  }

  // ---------------------------------------------------------
  // Salary rates
  // ---------------------------------------------------------

  const dailySalary = baseSalary / workingUnits;

  const halfDaySalary = dailySalary / 2;

  // ---------------------------------------------------------
  // Calculate attendance / leave
  // ---------------------------------------------------------

  let paidUnits = 0;
  let lopUnits = 0;

  let presentUnits = 0;
  let paidLeaveUnits = 0;
  let unpaidLeaveUnits = 0;

  let paidHolidayUnits = 0;
  let unpaidHolidayUnits = 0;

  const breakdown = [];

  for (const day of days) {
    const { date, dayOfWeek, type, workingUnits: dayWorkingUnits } = day;

    // -------------------------------------------------------
    // Sunday
    // -------------------------------------------------------

    if (type === "WEEKLY_OFF") {
      breakdown.push({
        date,
        type: "WEEKLY_OFF",
        workingUnits: 0,
        paidUnits: 0,
        lopUnits: 0,
      });

      continue;
    }

    // -------------------------------------------------------
    // Paid holiday
    // -------------------------------------------------------

    if (type === "PAID_HOLIDAY") {
      const holidayUnits = dayWorkingUnits;

      paidHolidayUnits += holidayUnits;
      paidUnits += holidayUnits;

      breakdown.push({
        date,
        type: "PAID_HOLIDAY",
        name: day.holidayName,
        workingUnits: holidayUnits,
        paidUnits: holidayUnits,
        lopUnits: 0,
      });

      continue;
    }

    // -------------------------------------------------------
    // Unpaid holiday
    // -------------------------------------------------------

    if (type === "UNPAID_HOLIDAY") {
      const holidayUnits = dayWorkingUnits;

      unpaidHolidayUnits += holidayUnits;
      lopUnits += holidayUnits;

      breakdown.push({
        date,
        type: "UNPAID_HOLIDAY",
        name: day.holidayName,
        workingUnits: holidayUnits,
        paidUnits: 0,
        lopUnits: holidayUnits,
      });

      continue;
    }

    // -------------------------------------------------------
    // Normal working day / Saturday
    // -------------------------------------------------------

    const attendance = attendanceMap.get(date) || {};

    const dayLeaves = leaveMap.get(date) || [];

    const sessions =
      dayOfWeek === 6 ? ["FIRST_HALF"] : ["FIRST_HALF", "SECOND_HALF"];

    let dayPresentUnits = 0;
    let dayPaidLeaveUnits = 0;
    let dayUnpaidLeaveUnits = 0;
    let dayLopUnits = 0;

    for (const session of sessions) {
      const sessionUnits = 0.5;

      // -----------------------------------------------------
      // Find applicable leave
      // -----------------------------------------------------

      const leave = dayLeaves.find(
        (item) =>
          item.leaveSession === "FULL_DAY" || item.leaveSession === session,
      );

      // -----------------------------------------------------
      // Paid / unpaid leave
      // -----------------------------------------------------

      if (leave) {
        if (leave.isPaid === true) {
          dayPaidLeaveUnits += sessionUnits;
          paidLeaveUnits += sessionUnits;
          paidUnits += sessionUnits;
        } else {
          dayUnpaidLeaveUnits += sessionUnits;
          unpaidLeaveUnits += sessionUnits;
          dayLopUnits += sessionUnits;
          lopUnits += sessionUnits;
        }

        continue;
      }

      // -----------------------------------------------------
      // Attendance
      // -----------------------------------------------------

      const status = attendance[session];

      if (status === "Present") {
        dayPresentUnits += sessionUnits;
        presentUnits += sessionUnits;
        paidUnits += sessionUnits;
      } else {
        // Missing attendance or Absent
        dayLopUnits += sessionUnits;
        lopUnits += sessionUnits;
      }
    }

    breakdown.push({
      date,
      type,
      workingUnits: dayWorkingUnits,

      presentUnits: dayPresentUnits,

      paidLeaveUnits: dayPaidLeaveUnits,

      unpaidLeaveUnits: dayUnpaidLeaveUnits,

      paidUnits: dayPresentUnits + dayPaidLeaveUnits,

      lopUnits: dayLopUnits,
    });
  }

  // ---------------------------------------------------------
  // LOP deduction
  // ---------------------------------------------------------

  const lopDeduction = roundMoney(lopUnits * dailySalary);

  // ---------------------------------------------------------
  // Bonus
  //
  // Preview starts with zero.
  // Create payroll can receive bonus from UI.
  // ---------------------------------------------------------

  const bonus = 0;

  const netSalary = roundMoney(baseSalary - lopDeduction + bonus);

  // ---------------------------------------------------------
  // Response expected by your React component
  // ---------------------------------------------------------

  return {
    employee: {
      id: employee.id,
      userUuid: user.uuid,
      fullName:
        user.fullName ||
        employee.fullName ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    },

    payPeriod: normalizedPayPeriod,

    salary: {
      salary: roundMoney(baseSalary),
    },

    calculation: {
      baseSalary: roundMoney(baseSalary),

      lopDeduction,

      bonus,

      netSalary,

      dailySalary: roundMoney(dailySalary),

      halfDaySalary: roundMoney(halfDaySalary),

      paidUnits: roundUnit(paidUnits),

      lopUnits: roundUnit(lopUnits),

      workingDays: roundUnit(workingUnits),

      presentUnits: roundUnit(presentUnits),

      paidLeaveUnits: roundUnit(paidLeaveUnits),

      unpaidLeaveUnits: roundUnit(unpaidLeaveUnits),

      paidHolidayUnits: roundUnit(paidHolidayUnits),

      unpaidHolidayUnits: roundUnit(unpaidHolidayUnits),

      breakdown,
    },
  };
};

// ---------------------------------------------------------------------------
// Create payroll
// ---------------------------------------------------------------------------

const createPayroll = async ({
  companyId,
  createdBy,
  userUuid,
  payPeriod,
  baseSalary,
  lopDeduction,
  bonus,
  paymentMethod,
}) => {
  // ---------------------------------------------------------
  // Get employee
  // ---------------------------------------------------------

  const { user, employee, salary } = await getEmployeeWithSalary({
    companyId,
    userUuid,
  });

  // ---------------------------------------------------------
  // Normalize period
  // ---------------------------------------------------------

  const { payPeriod: normalizedPayPeriod } = getMonthRange(payPeriod);

  // ---------------------------------------------------------
  // Recalculate on backend
  //
  // Never trust frontend LOP.
  // ---------------------------------------------------------

  const calculation = await calculatePayroll({
    companyId,
    userUuid,
    payPeriod: normalizedPayPeriod,
  });

  const actualBaseSalary = roundMoney(Number(salary.salary));

  const actualLop = roundMoney(calculation.calculation.lopDeduction);

  const requestedBonus = roundMoney(bonus);

  const netSalary = roundMoney(actualBaseSalary - actualLop + requestedBonus);

  // ---------------------------------------------------------
  // Validate payment method
  // ---------------------------------------------------------

  const allowedPaymentMethods = ["Bank Transfer", "UPI", "Cheque", "Cash"];

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    throw new Error("Invalid payment method");
  }

  // ---------------------------------------------------------
  // Create payroll
  // ---------------------------------------------------------

  const payroll = await Payroll.create({
    companyId,

    userId: user.id,

    payPeriod: normalizedPayPeriod,

    baseSalary: actualBaseSalary,

    lopDeduction: actualLop,

    bonus: requestedBonus,

    netSalary,

    paymentMethod,

    status: "Pending",

    createdBy,
  });

  // ---------------------------------------------------------
  // Return with employee details
  // ---------------------------------------------------------

  return getPayrollByUuid({
    companyId,
    uuid: payroll.uuid,
  });
};

// ---------------------------------------------------------------------------
// Get payroll by UUID
// ---------------------------------------------------------------------------

const getPayrollByUuid = async ({ companyId, uuid }) => {
  const payroll = await Payroll.findOne({
    where: {
      uuid,
      companyId,
    },

    include: [
      {
        model: User,
        as: "employee",
        attributes: ["id", "uuid", "firstName", "lastName", "email"],
      },
    ],
  });

  if (!payroll) {
    const error = new Error("Payroll not found");

    error.statusCode = 404;

    throw error;
  }

  return serializePayroll(payroll);
};

// ---------------------------------------------------------------------------
// Get payroll records
// ---------------------------------------------------------------------------

const getPayroll = async ({ companyId, userUuid, startDate, endDate }) => {
  const where = {
    companyId,
  };

  // ---------------------------------------------------------
  // Employee filter
  // ---------------------------------------------------------

  if (userUuid) {
    const user = await User.findOne({
      where: {
        uuid: userUuid,
        companyId,
      },

      attributes: ["id"],
    });

    if (!user) {
      return [];
    }

    where.userId = user.id;
  }

  // ---------------------------------------------------------
  // Date filters
  // ---------------------------------------------------------

  if (startDate || endDate) {
    where.payPeriod = {};

    if (startDate) {
      where.payPeriod[Op.gte] = startDate;
    }

    if (endDate) {
      where.payPeriod[Op.lte] = endDate;
    }
  }

  const payrolls = await Payroll.findAll({
    where,

    include: [
      {
        model: User,
        as: "employee",
        attributes: ["id", "uuid", "firstName", "lastName", "email"],
      },
    ],

    order: [
      ["payPeriod", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return payrolls.map(serializePayroll);
};

// ---------------------------------------------------------------------------
// Process payroll
// ---------------------------------------------------------------------------

const processPayroll = async ({ companyId, uuid, processedBy }) => {
  const payroll = await Payroll.findOne({
    where: {
      uuid,
      companyId,
    },
  });

  if (!payroll) {
    const error = new Error("Payroll not found");

    error.statusCode = 404;

    throw error;
  }

  if (payroll.status === "Processed") {
    throw new Error("Payroll is already processed");
  }

  await payroll.update({
    status: "Processed",
    processedAt: new Date(),
    processedBy,
  });

  return getPayrollByUuid({
    companyId,
    uuid,
  });
};

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

const serializePayroll = (payroll) => {
  const plain = payroll.get ? payroll.get({ plain: true }) : payroll;

  const employee = plain.employee;

  const fullName = employee
    ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
    : null;

  return {
    uuid: plain.uuid,

    payPeriod: formatDate(plain.payPeriod),

    baseSalary: Number(plain.baseSalary),

    lopDeduction: Number(plain.lopDeduction),

    bonus: Number(plain.bonus),

    netSalary: Number(plain.netSalary),

    paymentMethod: plain.paymentMethod,

    status: plain.status,

    processedAt: plain.processedAt,

    createdAt: plain.createdAt,

    updatedAt: plain.updatedAt,

    employee: employee
      ? {
          uuid: employee.uuid,
          fullName: fullName || "—",
          email: employee.email,
        }
      : null,
  };
};

module.exports = {
  listSalaries,
  setSalary,
  calculatePayroll,
  createPayroll,
  getPayroll,
  getPayrollByUuid,
  processPayroll,
};
