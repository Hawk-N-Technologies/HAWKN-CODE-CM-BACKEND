const {
  fetchAdminOverview,
} = require("../services/adminOverviewService");

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

module.exports = { getAdminOverview };
