const developerProjectService = require("../services/developerProjectService");

// userId + companyId always come from the login token, never from the request
async function listMyProjects(req, res, next) {
  try {
    const data = await developerProjectService.listMyProjects(req.user.userId, req.user.companyId);
    return res.status(200).json({ success: true, message: "Projects fetched successfully", data });
  } catch (error) {
    return next(error); // shared errorHandler logs it + sends a safe message
  }
}

// Project Lead dashboard: active phases, open tasks, completed tasks
async function getMySummary(req, res, next) {
  try {
    const data = await developerProjectService.getMySummary(req.user.userId, req.user.companyId);
    return res.status(200).json({ success: true, message: "Summary fetched successfully", data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listMyProjects,
  getMySummary,
};