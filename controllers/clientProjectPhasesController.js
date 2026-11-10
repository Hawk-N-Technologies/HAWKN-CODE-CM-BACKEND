const clientProjectPhasesService = require("../services/clientProjectPhasesService");

async function getProjectPhases(req, res, next) {
  try {
    const data = await clientProjectPhasesService.getProjectPhases(
      req.user.userId,
      req.user.companyId,
      req.params.projectUuid,
    );

    return res.status(200).json({
      success: true,
      message: "Project phases fetched successfully",
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getProjectPhases };