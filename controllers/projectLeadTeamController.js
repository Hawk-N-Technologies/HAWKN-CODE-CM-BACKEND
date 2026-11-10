"use strict";

const service = require("../services/projectLeadTeamService");

function handleError(error, res, next) {
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
    const data = await service.getLeadProjects(
      req.user.userId,
      req.user.companyId,
    );

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getTeam(req, res, next) {
  try {
    const data = await service.getTeam(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
    );

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function saveTeam(req, res, next) {
  try {
    const data = await service.saveTeam(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
      req.body,
    );

    return res.json({
      success: true,
      message: "Project team updated successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = { listProjects, getTeam, saveTeam };