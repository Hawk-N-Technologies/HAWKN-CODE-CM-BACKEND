"use strict";

const planningService = require("../services/projectLeadPlanningService");
const logger = require("../utils/logger");
function sendError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

async function listProjects(req, res, next) {
  try {
    const data = await planningService.listMyProjects(
      req.user.userId,
      req.user.companyId,
    );

    return res.json({
      success: true,
      message: "Planning projects fetched successfully.",
      data,
    });
  } catch (error) {
    return sendError(error, res, next);
  }
}

async function getPlanning(req, res, next) {
  try {
    const data = await planningService.getPlanning(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
    );
    console.log(data);
    return res.json({
      success: true,
      message: "Project planning fetched successfully.",
      data,
    });
  } catch (error) {
    return sendError(error, res, next);
  }
}

async function savePlanning(req, res, next) {
  try {
    const data = await planningService.savePlanning(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
      req.body,
      req.files,
    );

    return res.json({
      success: true,
      message: "Project planning saved successfully.",
      data,
    });
  } catch (error) {
    return sendError(error, res, next);
  }
}

async function getPlanningFileController(req, res) {
  try {
    const { projectUuid, kind } = req.params;

    const { filePath, fileName } = await planningService.getPlanningFile(
      projectUuid,
      kind,
    );

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        logger.error("Failed to send project planning file", {
          projectUuid,
          kind,
          error: error.message,
        });

        return res.status(error.statusCode || 500).json({
          success: false,
          message: "Failed to open planning document.",
        });
      }
    });
  } catch (error) {
    logger.error("Get project planning file failed", {
      projectUuid: req.params.projectUuid,
      kind: req.params.kind,
      error: error.message,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to open planning document.",
    });
  }
}

module.exports = {
  listProjects,
  getPlanning,
  savePlanning,
  getPlanningFileController,
};
