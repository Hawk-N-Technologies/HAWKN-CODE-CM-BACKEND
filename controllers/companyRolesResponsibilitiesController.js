const companyRolesResponsibilitiesService = require("../services/companyRolesResponsibilitiesService");

const logger = require("../utils/logger");

async function getRolesResponsibilities(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get roles and responsibilities request received", {
      userId: req.user.id,
      companyId,
    });

    const data =
      await companyRolesResponsibilitiesService.getRolesResponsibilities(
        companyId,
      );

    return res.status(200).json({
      success: true,
      message: "Roles and responsibilities fetched successfully",
      data,
    });
  } catch (error) {
    logger.error("Get roles and responsibilities controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function updateRolesResponsibilities(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { content } = req.body;

    logger.info("Update roles and responsibilities request received", {
      userId: req.user.id,
      companyId,
    });

    const data =
      await companyRolesResponsibilitiesService.updateRolesResponsibilities(
        companyId,
        content,
      );

    return res.status(200).json({
      success: true,
      message: "Roles and responsibilities updated successfully",
      data,
    });
  } catch (error) {
    logger.error("Update roles and responsibilities controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

module.exports = {
  getRolesResponsibilities,
  updateRolesResponsibilities,
};
