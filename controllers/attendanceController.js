const attendanceService = require("../services/attendanceService");
const logger = require("../utils/logger");

async function markAttendance(req, res) {
  try {
    const userId = req.user.userId;
    const companyId = req.user.companyId;

    const attendance = await attendanceService.markAttendance(
      userId,
      companyId,
    );

    return res.status(201).json({
      success: true,
      message: "Attendance marked successfully.",
      data: attendance,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getTodayAttendance(req, res) {
  try {
    const companyId = req.user.companyId;

    const attendance =
      await attendanceService.getCompanyTodayAttendance(companyId);

    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getAttendanceHistory(req, res) {
  try {
    const companyId = req.user.companyId;

    const result = await attendanceService.getAttendanceHistory(companyId, {
      page: req.query.page,
      limit: req.query.limit,
      from: req.query.from,
      to: req.query.to,
      search: req.query.search,
      employeeId: req.query.employeeId,
    });

    return res.status(200).json({
      success: true,
      message: "Attendance history fetched successfully.",
      data: result.records,
      pagination: result.pagination,
      filters: result.filters,
    });
  } catch (error) {
    logger.error("Get attendance history error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch attendance history.",
    });
  }
}

const getMyMonthlyAttendance = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    const { month, year } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in authentication token.",
      });
    }

    const result = await attendanceService.getEmployeeMonthlyAttendance({
      userId,
      month,
      year,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to fetch employee monthly attendance", { error: error?.message, stack: error?.stack });

    return next(error);
  }
};

module.exports = {
  markAttendance,
  getTodayAttendance,
  getAttendanceHistory,
  getMyMonthlyAttendance,
};
