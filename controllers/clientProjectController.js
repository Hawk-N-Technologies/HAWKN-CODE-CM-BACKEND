const {
  list,
} = require("@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/list.js");
const clientProjectService = require("../services/clientProjectService");

// userId + companyId always come from the login token, never from the request
async function getDashboardProjects(req, res, next) {
  try {
    const data = await clientProjectService.getDashboardProjects(
      req.user.userId,
      req.user.companyId,
    );
    return res
      .status(200)
      .json({ success: true, message: "Projects fetched successfully", data });
  } catch (error) {
    return next(error); // shared errorHandler logs it + sends a safe message
  }
}

async function getDashboardProjects(req, res, next) {
  try {
    const data = await clientProjectService.getDashboardProjects(
      req.user.userId,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

// --------------------------------------------------
// Client: List Projects (Pagination + Filters)
// --------------------------------------------------

async function listProjects(req, res, next) {
  try {
    const data = await clientProjectService.listProjects(
      req.user.userId,
      req.user.companyId,
      req.query,
    );

    return res.status(200).json({
      success: true,
      message: "Client projects fetched successfully",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboardProjects,
  listProjects
};
