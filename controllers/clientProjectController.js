const clientProjectService = require("../services/clientProjectService");

// userId + companyId always come from the login token, never from the request
async function getDashboardProjects(req, res, next) {
  try {
    const data = await clientProjectService.getDashboardProjects(req.user.userId, req.user.companyId);
    return res.status(200).json({ success: true, message: "Projects fetched successfully", data });
  } catch (error) {
    return next(error); // shared errorHandler logs it + sends a safe message
  }
}

module.exports = {
  getDashboardProjects,
};