const brdService = require("../services/brdService");
const logger = require("../utils/logger");
const path = require("path");
const fs = require("fs");
const BRDVersion = require("../models/BRDVersion");

// Resolve the authenticated user ID consistently.
function getAuthenticatedUserId(req) {
  return req.user?.userId ?? req.user?.id;
}

// Shared error response helper.
function sendError(res, error, fallbackMessage) {
  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

/**
 * BDE: Upload a BRD.
 */
async function uploadBRD(req, res, next) {
  try {
    const { projectUuid } = req.body;
    const userId = getAuthenticatedUserId(req);
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
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * BDE: Fetch projects.
 */
async function getAllProjects(req, res) {
  try {
    const { companyId } = req.user;

    const projects = await brdService.getAllProjects({ companyId });

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

    return sendError(res, error, "Failed to fetch projects");
  }
}

/**
 * BDE: Fetch BRD summary.
 */
async function getBRDSummary(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get BRD summary request received", {
      companyId,
      userId: getAuthenticatedUserId(req),
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
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * BDE: Fetch BRD history.
 */
async function getBRDHistory(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get BRD history request received", {
      companyId,
      userId: getAuthenticatedUserId(req),
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
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * BDE/Admin: Open an uploaded BRD file.
 *
 * Keep this endpoint behind authentication and appropriate
 * project/company authorization middleware.
 */
async function getBRDFile(req, res) {
  try {
    const { versionUuid } = req.params;

    const version = await BRDVersion.findOne({
      where: { uuid: versionUuid },
    });

    if (!version) {
      return res.status(404).json({
        success: false,
        message: "BRD file not found",
      });
    }

    if (!version.storageKey) {
      return res.status(404).json({
        success: false,
        message: "BRD file storage key not found",
      });
    }

    // Assumes storageKey is a filename inside uploads/brds.
    const fileName = path.basename(version.storageKey);
    const filePath = path.resolve(__dirname, "../uploads/brds", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "BRD file does not exist",
      });
    }

    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        logger.error("Failed to send BRD file", {
          versionUuid,
          error: error.message,
        });

        res.status(error.statusCode || 500).json({
          success: false,
          message: "Failed to open BRD file",
        });
      }
    });
  } catch (error) {
    logger.error("Get BRD file controller failed", {
      error: error.message,
      stack: error.stack,
    });

    return sendError(res, error, "Failed to open BRD file");
  }
}

/**
 * ADMIN: Fetch BRDs.
 *
 * Optional query parameters:
 *   ?status=PENDING_ADMIN_APPROVAL
 *   ?search=solar
 *   ?status=ALL
 */
async function getAdminBRDs(req, res, next) {
  try {
    const { status, search } = req.query;

    logger.info("Admin BRD list request received", {
      userId: getAuthenticatedUserId(req),
      status: status || "ALL",
      hasSearch: Boolean(search),
    });

    const brds = await brdService.getAdminBRDs({
      status,
      search,
    });

    return res.status(200).json({
      success: true,
      message: "Admin BRDs fetched successfully",
      data: brds,
    });
  } catch (error) {
    logger.error("Failed to fetch admin BRDs", {
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * ADMIN: Fetch one BRD and its version/review history.
 */
async function getAdminBRDById(req, res, next) {
  try {
    const { brdId } = req.params;

    if (!brdId) {
      return res.status(400).json({
        success: false,
        message: "BRD ID is required",
      });
    }

    const brd = await brdService.getAdminBRDById(brdId);

    return res.status(200).json({
      success: true,
      message: "BRD details fetched successfully",
      data: brd,
    });
  } catch (error) {
    logger.error("Failed to fetch admin BRD details", {
      brdId: req.params.brdId,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * ADMIN: Approve or reject a BRD.
 *
 * Request body:
 *   { "action": "APPROVED" }
 *
 * Or:
 *   { "action": "REJECTED", "message": "Please correct the scope." }
 */
async function decideAdminBRD(req, res, next) {
  try {
    const { brdId } = req.params;
    const { action, message } = req.body;
    const reviewerId = getAuthenticatedUserId(req);

    if (!brdId) {
      return res.status(400).json({
        success: false,
        message: "BRD ID is required",
      });
    }

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be APPROVED or REJECTED",
      });
    }

    if (
      action === "REJECTED" &&
      (typeof message !== "string" || !message.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }

    logger.info("Admin BRD decision request received", {
      brdId,
      reviewerId,
      action,
    });

    const result = await brdService.decideBRD({
      brdId,
      reviewerId,
      action,
      message,
    });

    return res.status(200).json({
      success: true,
      message:
        action === "APPROVED"
          ? "BRD approved and submitted for client approval"
          : "BRD rejected successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Admin BRD decision failed", {
      brdId: req.params.brdId,
      reviewerId: getAuthenticatedUserId(req),
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * CLIENT: List this client's BRDs.
 */
async function getClientBRDs(req, res, next) {
  try {
    const userId = req.user.userId ?? req.user.id;

    const brds = await brdService.getClientBRDs(userId);

    return res.status(200).json({
      success: true,
      message: "Client BRDs fetched successfully",
      data: brds,
    });
  } catch (error) {
    logger.error("Failed to fetch client BRDs", {
      userId: req.user?.userId ?? req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * CLIENT: Get one BRD and its version/review history.
 */
async function getClientBRDById(req, res, next) {
  try {
    const userId = req.user.userId ?? req.user.id;
    const { brdId } = req.params;

    const brd = await brdService.getClientBRDById({
      brdId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "BRD details fetched successfully",
      data: brd,
    });
  } catch (error) {
    logger.error("Failed to fetch client BRD details", {
      brdId: req.params.brdId,
      userId: req.user?.userId ?? req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

/**
 * CLIENT: Approve or reject a BRD.
 */
async function decideClientBRD(req, res, next) {
  try {
    const userId = req.user.userId ?? req.user.id;
    const { brdId } = req.params;
    const { action, message } = req.body;

    if (!["APPROVED", "REJECTED"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be APPROVED or REJECTED",
      });
    }

    if (
      action === "REJECTED" &&
      (typeof message !== "string" || !message.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }

    const result = await brdService.decideClientBRD({
      brdId,
      userId,
      action,
      message,
    });

    return res.status(200).json({
      success: true,
      message:
        action === "APPROVED"
          ? "BRD approved successfully"
          : "BRD rejected and returned for corrections",
      data: result,
    });
  } catch (error) {
    logger.error("Client BRD decision failed", {
      brdId: req.params.brdId,
      userId: req.user?.userId ?? req.user?.id,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

module.exports = {
  // Existing BDE functions
  uploadBRD,
  getAllProjects,
  getBRDSummary,
  getBRDHistory,
  getBRDFile,

  // Admin functions
  getAdminBRDs,
  getAdminBRDById,
  decideAdminBRD,

  ////
  //
  getClientBRDs,
  getClientBRDById,
  decideClientBRD,
};
