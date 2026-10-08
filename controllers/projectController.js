const Joi = require("joi");
const projectService = require("../services/projectService");
const logger = require("../utils/logger");

// --------------------------------------------------
// Validation
// --------------------------------------------------

const uuidSchema = Joi.string().guid().required();

const invalidId = (res) => {
  return res.status(400).json({
    success: false,
    message: "Invalid project ID",
  });
};

// --------------------------------------------------
// Error Handler
// --------------------------------------------------

const handleError = (error, res, next, logLabel, req) => {
  logger.error(logLabel, {
    userId: req.user?.userId,
    companyId: req.user?.companyId,
    uuid: req.params?.uuid,
    error: error.message,
  });

  // Validation errors
  if (Array.isArray(error.errors) && error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
  }

  // Known service error
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
};

// --------------------------------------------------
// Get Project Options
// GET /api/admin/projects/options
// --------------------------------------------------

const getOptions = async (req, res, next) => {
  try {
    const data = await projectService.getProjectOptions(req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Project options fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get project options failed", req);
  }
};

// --------------------------------------------------
// Get All Projects
// GET /api/admin/projects
// --------------------------------------------------

const listProjects = async (req, res, next) => {
  try {
    const data = await projectService.getProjects(
      req.user.companyId,
      req.validatedQuery?.status,
    );

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get projects failed", req);
  }
};

// --------------------------------------------------
// Get Single Project
// GET /api/admin/projects/:uuid
// --------------------------------------------------

const getProject = async (req, res, next) => {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return invalidId(res);
    }

    const data = await projectService.getProjectByUuid(
      req.user.companyId,
      req.params.uuid,
    );

    return res.status(200).json({
      success: true,
      message: "Project fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(error, res, next, "Get project failed", req);
  }
};

// --------------------------------------------------
// Create Project
// POST /api/admin/projects
// --------------------------------------------------

const createProject = async (req, res, next) => {
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
};

// --------------------------------------------------
// Update Project
// PUT /api/admin/projects/:uuid
// --------------------------------------------------

const updateProject = async (req, res, next) => {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return invalidId(res);
    }

    const data = await projectService.updateProject(
      req.user.companyId,
      req.params.uuid,
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
};

// --------------------------------------------------
// Delete Project
// DELETE /api/admin/projects/:uuid
// --------------------------------------------------

const deleteProject = async (req, res, next) => {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return invalidId(res);
    }

    const data = await projectService.deleteProject(
      req.user.companyId,
      req.params.uuid,
    );

    return res.status(200).json({
      success: true,
      message: data.message || "Project deleted successfully",
      data: null,
    });
  } catch (error) {
    return handleError(error, res, next, "Delete project failed", req);
  }
};

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
