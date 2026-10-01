const attendanceService = require("../services/attendanceService");

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

    const attendance = await attendanceService.getCompanyTodayAttendance(companyId);

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

module.exports = {
  markAttendance,
  getTodayAttendance,
};
