const Joi = require("joi");
const projectService = require("../services/projectService");
const logger = require("../utils/logger");

// --------------------------------------------------
// Validation
// --------------------------------------------------

const uuidSchema = Joi.string().guid().required();

function invalidId(res) {
  return res.status(400).json({
    success: false,
    message: "Invalid project ID",
  });
}

// --------------------------------------------------
// Error Handler
// --------------------------------------------------

function handleError(error, res, next, logLabel, req) {
  logger.error(logLabel, {
    userId: req.user?.userId,
    companyId: req.user?.companyId,
    uuid: req.params?.uuid,
    error: error.message,
    stack: error.stack,
  });

  // Service validation errors
  if (error.statusCode && Array.isArray(error.errors)) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
  }

  // Known service errors
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  // Unknown errors -> global error middleware
  return next(error);
}

// --------------------------------------------------
// Get Project Options
// GET /api/admin/projects/options
// --------------------------------------------------

async function getOptions(req, res, next) {
  try {
    const data = await projectService.getOptions(req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Project options fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get project options failed", req);
  }
}

// --------------------------------------------------
// Get All Projects
// GET /api/admin/projects
// --------------------------------------------------

async function listProjects(req, res, next) {
  try {
    const data = await projectService.listProjects(
      req.user.companyId,
      req.validatedQuery?.status
        ? {
            status: req.validatedQuery.status,
          }
        : {},
    );

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get projects failed", req);
  }
}

// --------------------------------------------------
// Get Single Project
// GET /api/admin/projects/:uuid
// --------------------------------------------------

async function getProject(req, res, next) {
  try {
    const { error } = uuidSchema.validate(req.params.uuid);

    if (error) {
      return invalidId(res);
    }

    const data = await projectService.getProject(
      req.params.uuid,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Project fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get project failed", req);
  }
}

// --------------------------------------------------
// Create Project
// POST /api/admin/projects
// --------------------------------------------------

async function createProject(req, res, next) {
  try {
    const data = await projectService.createProject(
      req.user.companyId,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: `Project "${data.name}" created successfully`,
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Create project failed", req);
  }
}

// --------------------------------------------------
// Update Project
// PUT /api/admin/projects/:uuid
// --------------------------------------------------

async function updateProject(req, res, next) {
  try {
    const { error } = uuidSchema.validate(req.params.uuid);

    if (error) {
      return invalidId(res);
    }

    const data = await projectService.updateProject(
      req.params.uuid,
      req.user.companyId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: `Project "${data.name}" updated successfully`,
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Update project failed", req);
  }
}

// --------------------------------------------------
// Delete Project
// DELETE /api/admin/projects/:uuid
// --------------------------------------------------

async function deleteProject(req, res, next) {
  try {
    const { error } = uuidSchema.validate(req.params.uuid);

    if (error) {
      return invalidId(res);
    }

    await projectService.deleteProject(req.params.uuid, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: null,
    });
  } catch (error) {
    return handleError(error, res, next, "Delete project failed", req);
  }
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  getOptions,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};
