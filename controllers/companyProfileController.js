const companyProfileService = require("../services/companyProfileService");
const logger = require("../utils/logger");

async function getCompanyProfile(req, res, next) {
  try {
    const companyId = 1;

    logger.info("Get company profile request received", {
      companyId,
    });

    const profile = await companyProfileService.getCompanyProfile(companyId);

    return res.status(200).json({
      success: true,
      message: "Company profile fetched successfully",
      data: profile,
    });
  } catch (error) {
    logger.error("Get company profile controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function updateCompanyProfile(req, res, next) {
  try {
    const { uuid } = req.params;

    // logger.info("Update company profile request received", {
    //   profileUuid: uuid,
    // });
``
    const profile = await companyProfileService.updateCompanyProfile(
      uuid,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      data: profile,
    });
  } catch (error) {
    logger.error("Update company profile controller failed", {
      profileUuid: req.params.uuid,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
};
