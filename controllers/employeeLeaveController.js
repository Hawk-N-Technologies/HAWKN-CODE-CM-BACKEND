const employeeLeaveService = require("../services/employeeLeaveService");

async function getLeaveRequests(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { status = "PENDING" } = req.query;

    const leaves = await employeeLeaveService.getLeaveRequests(
      companyId,
      status,
    );

    return res.status(200).json({
      success: true,
      message: "Leave requests fetched successfully",
      data: leaves,
    });
  } catch (error) {
    next(error);
  }
}

async function updateLeaveRequest(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { uuid } = req.params;
    console.log(req.body);
    const leave = await employeeLeaveService.updateLeaveRequest(
      companyId,
      uuid,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Leave request updated successfully.",
      data: leave,
    });
  } catch (error) {
    console.error("Update leave request controller failed:", error);

    next(error);
  }
}

async function createLeaveRequest(req, res) {
  try {
    // Assuming auth middleware puts employee information in req.user
    console.log(req.user);
    const userId = req.user.userId;
    const companyId = req.user.companyId;

    const { leave_date, leave_type, leave_session, reason } = req.body;

    const leave = await employeeLeaveService.createLeaveRequest({
      userId,
      companyId,
      leaveDate: leave_date,
      leaveType: leave_type,
      leaveSession: leave_session,
      reason,
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leave,
    });
  } catch (error) {
    console.error("Create leave request error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

const getMyLeaves = async (req, res) => {
  try {
    const userId = req.user.userId;
    const companyId = req.user.companyId;

    const tab = String(req.query.tab || "PENDING").toUpperCase();

    const leaves = await employeeLeaveService.getMyLeaves({
      userId,
      companyId,
      tab,
    });

    return res.status(200).json({
      success: true,
      data: leaves,
    });
  } catch (error) {
    console.error("Get my leaves error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch leave records.",
    });
  }
};

module.exports = {
  getLeaveRequests,
  updateLeaveRequest,
  createLeaveRequest,
  getMyLeaves,
};
