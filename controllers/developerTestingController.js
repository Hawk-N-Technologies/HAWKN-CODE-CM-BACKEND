"use strict";

const service = require("../services/developerTestingService");

async function getMyTestingRecords(req, res, next) {
  try {
    const data = await service.getMyTestingRecords(
      req.user.userId,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Developer testing records fetched successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function saveTestingResult(req, res, next) {
  try {
    const { taskUuid } = req.params;
    const { result, notes } = req.body;

    if (!taskUuid) {
      return res.status(400).json({
        success: false,
        message: "Task UUID is required.",
      });
    }

    if (typeof result !== "string") {
      return res.status(400).json({
        success: false,
        message: "A testing result is required.",
      });
    }

    if (notes !== undefined && typeof notes !== "string") {
      return res.status(400).json({
        success: false,
        message: "Testing notes must be text.",
      });
    }

    const data = await service.saveTestingResult(
      taskUuid,
      req.user.userId,
      req.user.companyId,
      { result, notes: notes ?? "" },
    );

    return res.status(200).json({
      success: true,
      message: "Developer testing result saved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyTestingRecords,
  saveTestingResult,
};