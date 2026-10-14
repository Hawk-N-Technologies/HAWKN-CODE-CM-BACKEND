"use strict";

const service = require("../services/testerDashBoardService");

function handleError(error, res, next) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return next(error);
}

async function getAssignedProjects(req, res, next) {
  try {
    const data = await service.getAssignedProjects(
      req.user.userId,
      req.user.companyId,
    );

    return res.json({
      success: true,
      message: "Assigned testing projects fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getOverview(req, res, next) {
  try {
    const data = await service.getOverview(
      req.user.userId,
      req.user.companyId,
    );

    return res.json({
      success: true,
      message: "Tester dashboard fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = { getAssignedProjects, getOverview };