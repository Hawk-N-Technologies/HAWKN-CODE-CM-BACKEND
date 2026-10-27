const { Op } = require('@sequelize/core');
const sequelize = require('../config/db');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const User = require('../models/User');
const EmployeeLeave = require('../models/EmployeeLeave');
const CompanyHoliday = require('../models/CompanyHoliday');

const INDIA_TIMEZONE = 'Asia/Kolkata';
const VALID_SESSIONS = new Set(['FIRST_HALF', 'SECOND_HALF']);

function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
  };
}

function getApplicableSessions(weekday) {
  if (weekday === 'Sun') return [];
  if (weekday === 'Sat') return ['FIRST_HALF'];
  return ['FIRST_HALF', 'SECOND_HALF'];
}

function getLeaveForSession(leaves, session) {
  return leaves.find((leave) =>
    leave.leaveStatus === 'APPROVED' &&
    (leave.leaveSession === 'FULL_DAY' || leave.leaveSession === session)
  ) || null;
}

function serializeEmployee(employee, attendanceBySession, leaves, applicableSessions, holiday) {
  const user = employee.user;
  const sessions = {};

  for (const session of ['FIRST_HALF', 'SECOND_HALF']) {
    if (!applicableSessions.includes(session)) {
      sessions[session] = {
        applicable: false,
        status: session === 'SECOND_HALF' && getIndiaDateParts().weekday === 'Sat' ? 'NOT_APPLICABLE' : 'WEEKLY_OFF',
        attendanceUuid: null,
        checkIn: null,
        canMark: false,
      };
      continue;
    }

    const attendance = attendanceBySession[session];
    const leave = getLeaveForSession(leaves, session);
    let status = 'NOT_MARKED';
    let canMark = true;

    if (holiday) {
      status = 'HOLIDAY';
      canMark = false;
    } else if (leave) {
      status = 'ON_LEAVE';
      canMark = false;
    } else if (attendance) {
      status = attendance.status === 'Present' ? 'PRESENT' : 'ABSENT';
      canMark = false;
    }

    sessions[session] = {
      applicable: true,
      status,
      attendanceUuid: attendance?.uuid || null,
      checkIn: attendance?.checkIn || null,
      leave: leave ? {
        uuid: leave.uuid,
        leaveType: leave.leaveType,
        leaveSession: leave.leaveSession,
        leaveStatus: leave.leaveStatus,
        isPaid: leave.isPaid,
      } : null,
      canMark,
    };
  }

  return {
    id: employee.id,
    uuid: employee.uuid,
    userId: employee.userId,
    employeeCode: employee.employeeCode || employee.employee_code || null,
    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Unknown Employee',
    email: user?.email || employee.companyEmail || null,
    firstHalf: sessions.FIRST_HALF.status,
    secondHalf: sessions.SECOND_HALF.status,
    sessions,
  };
}

async function getManualAttendanceToday(companyId) {
  if (!companyId) {
    const error = new Error('Company ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const { date: attendanceDate, weekday } = getIndiaDateParts();
  const applicableSessions = getApplicableSessions(weekday);

  const [holiday, employees, attendanceRecords, leaveRecords] = await Promise.all([
    CompanyHoliday.findOne({ where: { companyId, holidayDate: attendanceDate } }),
    Employee.findAll({
      where: { companyId },
      attributes: { exclude: [] },
      include: [{ model: User, as: 'user', attributes: ['id', 'uuid', 'firstName', 'lastName', 'email'], required: false }],
      order: [['id', 'ASC']],
    }),
    Attendance.findAll({ where: { companyId, attendanceDate } }),
    EmployeeLeave.findAll({
      where: { companyId, leaveDate: attendanceDate, leaveStatus: 'APPROVED' },
    }),
  ]);

  const attendanceMap = new Map();
  for (const record of attendanceRecords) {
    if (!attendanceMap.has(record.employeeId)) attendanceMap.set(record.employeeId, {});
    attendanceMap.get(record.employeeId)[record.session] = record;
  }

  const leaveMap = new Map();
  for (const leave of leaveRecords) {
    if (!leaveMap.has(leave.employeeId)) leaveMap.set(leave.employeeId, []);
    leaveMap.get(leave.employeeId).push(leave);
  }

  return {
    date: attendanceDate,
    timezone: INDIA_TIMEZONE,
    weekday,
    isHoliday: Boolean(holiday),
    holiday: holiday ? { uuid: holiday.uuid, name: holiday.name, isPaid: holiday.isPaid } : null,
    isWeekend: weekday === 'Sun',
    applicableSessions,
    employees: employees.map((employee) => serializeEmployee(
      employee,
      attendanceMap.get(employee.id) || {},
      leaveMap.get(employee.id) || [],
      applicableSessions,
      holiday,
    )),
  };
}

async function markManualAttendance({ companyId, employeeId, session }) {
  if (!companyId) {
    const error = new Error('Company ID is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(Number(employeeId)) || Number(employeeId) <= 0) {
    const error = new Error('A valid employeeId is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!VALID_SESSIONS.has(session)) {
    const error = new Error('Session must be FIRST_HALF or SECOND_HALF.');
    error.statusCode = 400;
    throw error;
  }

  const { date: attendanceDate, weekday } = getIndiaDateParts();
  const applicableSessions = getApplicableSessions(weekday);
  if (!applicableSessions.includes(session)) {
    const error = new Error(weekday === 'Sun'
      ? 'Attendance cannot be marked on Sunday.'
      : 'Only first-half attendance is applicable on Saturday.');
    error.statusCode = 409;
    throw error;
  }

  const transaction = await sequelize.startUnmanagedTransaction();
  try {
    const employee = await Employee.findOne({
      where: { id: Number(employeeId), companyId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!employee) {
      const error = new Error('Employee not found in this company.');
      error.statusCode = 404;
      throw error;
    }

    const holiday = await CompanyHoliday.findOne({
      where: { companyId, holidayDate: attendanceDate }, transaction,
    });
    if (holiday) {
      const error = new Error(`Today is a company holiday: ${holiday.name}.`);
      error.statusCode = 409;
      throw error;
    }

    const leave = await EmployeeLeave.findOne({
      where: {
        employeeId: Number(employeeId), companyId, leaveDate: attendanceDate,
        leaveStatus: 'APPROVED',
        [Op.or]: [{ leaveSession: 'FULL_DAY' }, { leaveSession: session }],
      },
      transaction,
    });
    if (leave) {
      const error = new Error(`Attendance cannot be marked: employee has approved ${leave.leaveSession.toLowerCase().replace('_', '-')} leave.`);
      error.statusCode = 409;
      throw error;
    }

    const existing = await Attendance.findOne({
      where: { employeeId: Number(employeeId), companyId, attendanceDate, session },
      transaction,
    });
    if (existing) {
      const error = new Error(`${session === 'FIRST_HALF' ? 'First' : 'Second'}-half attendance has already been marked.`);
      error.statusCode = 409;
      throw error;
    }

    const attendance = await Attendance.create({
      employeeId: Number(employeeId),
      companyId,
      attendanceDate,
      session,
      checkIn: new Date(),
      status: 'Present',
    }, { transaction });

    await transaction.commit();
    return attendance;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = { getManualAttendanceToday, markManualAttendance };
