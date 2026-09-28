const employeeHierarchyService = require("../services/employeeHierarchyService");

const logger = require("../utils/logger");

async function getHierarchyImages(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Get employee hierarchy images request received", {
      userId: req.user.id,
      companyId,
    });

    const images = await employeeHierarchyService.getHierarchyImages(companyId);

    return res.status(200).json({
      success: true,
      message: "Employee hierarchy images fetched successfully",
      data: images,
    });
  } catch (error) {
    logger.error("Get employee hierarchy images controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function uploadHierarchyImages(req, res, next) {
  try {
    const companyId = req.user.companyId;

    logger.info("Upload employee hierarchy images request received", {
      userId: req.user.id,
      companyId,
      fileCount: req.files ? req.files.length : 0,
    });

    if (!req.files || req.files.length === 0) {
      const error = new Error("At least one hierarchy image is required");

      error.statusCode = 400;

      throw error;
    }

    /*
     * The upload middleware should already have uploaded
     * the files to storage and populated the required data.
     */

    const files = req.files.map(function (file) {
      return {
        originalFileName: file.originalname,
        fileUrl: file.location || file.path,
        storageKey: file.key || null,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
    });

    const images = await employeeHierarchyService.uploadHierarchyImages(
      companyId,
      files,
    );

    return res.status(201).json({
      success: true,
      message: "Employee hierarchy images uploaded successfully",
      data: images,
    });
  } catch (error) {
    logger.error("Upload employee hierarchy images controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function deleteHierarchyImage(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { imageUuid } = req.params;

    logger.info("Delete employee hierarchy image request received", {
      userId: req.user.id,
      companyId,
      imageUuid,
    });

    await employeeHierarchyService.deleteHierarchyImage(companyId, imageUuid);

    return res.status(200).json({
      success: true,
      message: "Employee hierarchy image deleted successfully",
    });
  } catch (error) {
    logger.error("Delete employee hierarchy image controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      imageUuid: req.params?.imageUuid,
      error: error.message,
    });

    return next(error);
  }
}

module.exports = {
  getHierarchyImages,
  uploadHierarchyImages,
  deleteHierarchyImage,
};
