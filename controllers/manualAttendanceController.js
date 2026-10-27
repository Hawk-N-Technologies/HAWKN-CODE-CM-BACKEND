const manualAttendanceService = require('../services/manualAttendanceService');

// Adjust this helper to match the authenticated user shape used by your auth middleware.
function getCompanyId(req) {
  return req.user?.companyId ?? req.user?.company_id ?? req.companyId ?? null;
}


async function getToday(req, res, next) {
  try {
    const companyId = getCompanyId(req);
    const data = await manualAttendanceService.getManualAttendanceToday(companyId);
    return res.status(200).json({ success: true, message: "Today's manual attendance loaded.", data });
  } catch (error) {
    return next(error);
  }
}

async function markPresent(req, res, next) {
  try {
    const companyId = getCompanyId(req);
    const employeeId = Number(req.params.employeeId);
    const { session } = req.body || {};

    const attendance = await manualAttendanceService.markManualAttendance({
      companyId,
      employeeId,
      session,
    });

    return res.status(201).json({
      success: true,
      message: `${session === 'FIRST_HALF' ? 'First' : 'Second'}-half attendance marked successfully.`,
      data: attendance,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getToday, markPresent };
