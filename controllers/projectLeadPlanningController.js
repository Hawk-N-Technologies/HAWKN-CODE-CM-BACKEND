"use strict";

const planningService = require("../services/projectLeadPlanningService");

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

async function downloadFile(req, res, next) {
  try {
    const filePath = await planningService.getPlanningFile(
      req.params.projectUuid,
      req.params.kind,
      req.user.userId,
      req.user.companyId,
    );

    return res.download(filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return sendError(error, res, next);
  }
}

module.exports = {
  listProjects,
  getPlanning,
  savePlanning,
  downloadFile,
};