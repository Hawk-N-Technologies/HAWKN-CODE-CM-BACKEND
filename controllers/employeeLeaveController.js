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

module.exports = { getLeaveRequests, updateLeaveRequest };
