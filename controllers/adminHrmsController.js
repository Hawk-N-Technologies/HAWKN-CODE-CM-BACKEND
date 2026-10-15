const adminHrmsService = require("../services/adminHrmsService");

/**
 * Read-only admin HRMS endpoints. companyId always comes from the login
 * token — an admin can only ever see their own company's data.
 * Errors go to the shared errorHandler (Express 5 forwards async errors).
 */

// Builds a GET handler: calls the service, sends { success, message, data }
const readOnly = (serviceFn, label) => async (req, res, next) => {
  try {
    const data = await serviceFn(req.user.companyId, req.validatedQuery ?? {});
    return res.status(200).json({ success: true, message: `${label} fetched successfully`, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSummary: readOnly(adminHrmsService.getSummary, "HRMS summary"),
  getEmployees: readOnly(adminHrmsService.getEmployees, "Employees"),
  getAttendance: readOnly(adminHrmsService.getAttendance, "Attendance"),
  getLeaves: readOnly(adminHrmsService.getLeaves, "Leaves"),
  getPayroll: readOnly(adminHrmsService.getPayroll, "Payroll"),
  getInternshipProbation: readOnly(adminHrmsService.getInternshipProbation, "Internship / probation"),
};