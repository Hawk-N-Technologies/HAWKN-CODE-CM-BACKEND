"use strict";

const service = require("../services/projectLeadTechStackService");

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
    const data = await service.listProjects(
      req.user.userId,
      req.user.companyId,
    );

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getStack(req, res, next) {
  try {
    const data = await service.getStack(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
    );

    return res.json({ success: true, data });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function saveStack(req, res, next) {
  try {
    const data = await service.saveStack(
      req.params.projectUuid,
      req.user.userId,
      req.user.companyId,
      req.body.technologyStack,
    );

    return res.json({
      success: true,
      message: "Technology stack saved successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = { listProjects, getStack, saveStack };