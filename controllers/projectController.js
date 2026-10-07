const Joi = require("joi");
const projectService = require("../services/projectService");
const logger = require("../utils/logger");

// companyId always comes from the login token, never from the request
const uuidSchema = Joi.string().guid().required();

const invalidId = (res) => res.status(400).json({ success: false, message: "Invalid project ID" });

/**
 * Field-level errors (bad client, deadline before start, duplicate name…)
 * are sent in the same shape as the validate middleware —
 * { success, message, errors: [{ field, message }] } — so the form can
 * show them under the right inputs. Everything else → shared errorHandler.
 */
function handleError(error, res, next, logLabel, req) {
  logger.error(logLabel, { userId: req.user?.userId, uuid: req.params?.uuid, error: error.message });
  if (Array.isArray(error.errors) && error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message, errors: error.errors });
  }
  return next(error);
}

async function getOptions(req, res, next) {
  try {
    const data = await projectService.getOptions(req.user.companyId);
    return res.status(200).json({ success: true, message: "Options fetched successfully", data });
  } catch (error) {
    return handleError(error, res, next, "Project options controller failed", req);
  }
}

async function listProjects(req, res, next) {
  try {
    const data = await projectService.listProjects(req.user.companyId, req.validatedQuery);
    return res.status(200).json({ success: true, message: "Projects fetched successfully", data });
  } catch (error) {
    return handleError(error, res, next, "List projects controller failed", req);
  }
}

async function getProject(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    const data = await projectService.getProject(req.params.uuid, req.user.companyId);
    return res.status(200).json({ success: true, message: "Project fetched successfully", data });
  } catch (error) {
    return handleError(error, res, next, "Get project controller failed", req);
  }
}

async function createProject(req, res, next) {
  try {
    const data = await projectService.createProject(req.user.companyId, req.body);
    return res.status(201).json({ success: true, message: `Project "${data.name}" created`, data });
  } catch (error) {
    return handleError(error, res, next, "Create project controller failed", req);
  }
}

async function updateProject(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    const data = await projectService.updateProject(req.params.uuid, req.user.companyId, req.body);
    return res.status(200).json({ success: true, message: `Project "${data.name}" updated`, data });
  } catch (error) {
    return handleError(error, res, next, "Update project controller failed", req);
  }
}

async function deleteProject(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    await projectService.deleteProject(req.params.uuid, req.user.companyId);
    return res.status(200).json({ success: true, message: "Project deleted", data: null });
  } catch (error) {
    return handleError(error, res, next, "Delete project controller failed", req);
  }
}

module.exports = {
  getOptions,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};