const hrDashboardService = require("../services/hrDashboardService");

async function getDashboard(req, res, next) {
  try {
    const data = await hrDashboardService.getDashboard(req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "HR dashboard fetched successfully.",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getDashboard };