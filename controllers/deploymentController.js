const Joi = require("joi");
const deploymentService = require("../services/deploymentService");

// companyId + userId always come from the login token, never from the request
const uuidSchema = Joi.string().guid().required();
const invalidId = (res) => res.status(400).json({ success: false, message: "Invalid project ID" });

// Errors → shared errorHandler (logs them + sends a safe message)

async function listProjects(req, res, next) {
  try {
    const data = await deploymentService.listProjects(req.user.companyId);
    return res.status(200).json({ success: true, message: "Deployment plans fetched successfully", data });
  } catch (error) {
    return next(error);
  }
}

async function getPlan(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.projectUuid).error) return invalidId(res);
    const data = await deploymentService.getPlan(req.params.projectUuid, req.user.companyId);
    return res.status(200).json({ success: true, message: "Deployment plan fetched successfully", data });
  } catch (error) {
    return next(error);
  }
}

async function savePlan(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.projectUuid).error) return invalidId(res);
    const { created, ...data } = await deploymentService.savePlan(
      req.params.projectUuid,
      req.user.companyId,
      req.user.userId,
      req.body, // already cleaned by validate(deploymentSchema)
    );
    return res.status(created ? 201 : 200).json({
      success: true,
      message: `Deployment plan ${created ? "created" : "updated"} for ${data.project.name}`,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listProjects,
  getPlan,
  savePlan,
};