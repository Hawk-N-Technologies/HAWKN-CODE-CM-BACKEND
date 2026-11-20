const {
  fetchAdminOverview,
} = require("../services/adminOverviewService");
const { getMonitoring } = require("../services/developmentMonitoringService");

const getAdminOverview = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    if (companyId == null) {
      return res.status(403).json({
        success: false,
        message: "Company context is required",
      });
    }

    const overview = await fetchAdminOverview(companyId);

    return res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
};

// Admin → Development Monitoring (read-only)
const getDevelopmentMonitoring = async (req, res, next) => {
  try {
    const data = await getMonitoring(req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Development monitoring fetched successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminOverview, getDevelopmentMonitoring };
