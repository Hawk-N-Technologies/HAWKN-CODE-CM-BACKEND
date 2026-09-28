const companyPolicyService = require("../services/companyPolicyService");
const logger = require("../utils/logger");

async function getCompanyPolicies(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get company policies request received", {
      userId: req.user.id,
      companyId,
    });

    const policies = await companyPolicyService.getCompanyPolicies(companyId);

    return res.status(200).json({
      success: true,
      message: "Company policies fetched successfully",
      data: policies,
    });
  } catch (error) {
    logger.error("Get company policies controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function updateCompanyPolicies(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { content } = req.body;

    logger.info("Update company policies request received", {
      userId: req.user.id,
      companyId,
    });

    const policies = await companyPolicyService.updateCompanyPolicies(
      companyId,
      content,
    );

    return res.status(200).json({
      success: true,
      message: "Company policies updated successfully",
      data: policies,
    });
  } catch (error) {
    logger.error("Update company policies controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

module.exports = {
  getCompanyPolicies,
  updateCompanyPolicies,
};
 