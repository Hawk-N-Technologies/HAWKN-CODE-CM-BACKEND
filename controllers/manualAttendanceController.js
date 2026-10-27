const manualAttendanceService = require("../services/manualAttendanceService");

// Adjust this helper to match your authentication middleware.
function getCompanyId(req) {
  return req.user?.companyId ?? req.user?.company_id ?? req.companyId ?? null;
}

async function getToday(req, res, next) {
  try {
    const companyId = getCompanyId(req);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required.",
      });
    }

    const data =
      await manualAttendanceService.getManualAttendanceToday(companyId);

    return res.status(200).json({
      success: true,
      message: "Today's manual attendance loaded successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

async function markAttendance(req, res, next) {
  try {
    const companyId = getCompanyId(req);
    const employeeId = Number(req.params.employeeId);

    const { session, status, leaveType, reason, isPaid } = req.body || {};

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required.",
      });
    }

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid employee ID is required.",
      });
    }

    if (!["FIRST_HALF", "SECOND_HALF"].includes(session)) {
      return res.status(400).json({
        success: false,
        message: "Session must be FIRST_HALF or SECOND_HALF.",
      });
    }

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be Present or Absent.",
      });
    }

    // Validate absence details before calling the service.
    if (status === "Absent") {
      if (!["SICK", "CASUAL", "OTHER"].includes(leaveType)) {
        return res.status(400).json({
          success: false,
          message: "Select Sick Leave, Casual Leave, or Custom Leave.",
        });
      }

      if (leaveType === "OTHER" && !reason?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Please enter a reason for Custom Leave.",
        });
      }

      if (typeof isPaid !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Please specify whether this leave is paid.",
        });
      }
    }

    const attendance = await manualAttendanceService.markManualAttendance({
      companyId,
      employeeId,
      session,
      status,
      leaveType: status === "Absent" ? leaveType : undefined,
      reason: status === "Absent" ? reason : undefined,
      isPaid: status === "Absent" ? isPaid : undefined,
      reviewedBy: req.user?.id ?? null,
    });

    return res.status(201).json({
      success: true,
      message: `${
        session === "FIRST_HALF" ? "First" : "Second"
      }-half attendance marked ${status.toLowerCase()} successfully.`,
      data: attendance,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getToday,
  markAttendance,
};
