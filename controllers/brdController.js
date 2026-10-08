const brdService = require("../services/brdService");
const logger = require("../utils/logger");
const path = require("path");
const fs = require("fs");
const BRDVersion = require("../models/BRDVersion");

async function uploadBRD(req, res, next) {
  try {
    const { projectUuid } = req.body;
    console.log(req.body);
    const userId = req.user.userId;
    const companyId = req.user.companyId;

    logger.info("BDE BRD upload request received", {
      projectUuid,
      userId,
      companyId,
    });

    const result = await brdService.uploadBRD({
      projectUuid,
      companyId,
      userId,
      file: req.file,
    });

    return res.status(201).json({
      success: true,
      message: "BRD uploaded and submitted for admin approval",
      data: {
        brd: result.brd,
        version: result.version,
      },
    });
  } catch (error) {
    logger.error("BDE BRD upload controller failed", {
      error: error.message,
    });

    return next(error);
  }
}

async function getAllProjects(req, res) {
  try {
    const { companyId } = req.user;

    const projects = await brdService.getAllProjects({
      companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: projects,
    });
  } catch (error) {
    logger.error("Failed to fetch projects", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch projects",
    });
  }
}
async function getBRDSummary(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get BRD summary request received", {
      companyId,
      userId: req.user.id,
    });

    const summary = await brdService.getBRDSummary(companyId);

    return res.status(200).json({
      success: true,
      message: "BRD summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    logger.error("Get BRD summary controller failed", {
      error: error.message,
    });

    return next(error);
  }
}

async function getBRDHistory(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get BRD history request received", {
      companyId,
      userId: req.user.id,
    });

    const history = await brdService.getBRDHistory(companyId);

    return res.status(200).json({
      success: true,
      message: "BRD history fetched successfully",
      data: history,
    });
  } catch (error) {
    logger.error("Get BRD history controller failed", {
      error: error.message,
    });

    return next(error);
  }
}

async function getBRDFile(req, res) {
  try {
    console.log("request");
    const { versionUuid } = req.params;

    const version = await BRDVersion.findOne({
      where: {
        uuid: versionUuid,
      },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "BRD file not found",
      });
    }

    const filePath = path.resolve(
      __dirname,
      "../uploads/brds",
      version.storageKey,
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "BRD file does not exist",
      });
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to open BRD file",
    });
  }
}
module.exports = {
  uploadBRD,
  getAllProjects,
  getBRDSummary,
  getBRDHistory,
  getBRDFile,
};
