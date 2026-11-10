const EmployeeHierarchyImage = require("../models/EmployeeHierarchyImage");
const logger = require("../utils/logger");

async function getHierarchyImages(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const images = await EmployeeHierarchyImage.findAll({
      where: {
        companyId: companyId,
        isActive: true,
      },
      attributes: [
        "uuid",
        "originalFileName",
        "fileUrl",
        "mimeType",
        "fileSize",
        "sortOrder",
        "createdAt",
        "updatedAt",
      ],
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    logger.info("Employee hierarchy images fetched successfully", {
      companyId: companyId,
      count: images.length,
    });

    return images;
  } catch (error) {
    logger.error("Failed to fetch employee hierarchy images", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function uploadHierarchyImages(companyId, files) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(files) || files.length === 0) {
      const error = new Error("At least one image is required");
      error.statusCode = 400;
      throw error;
    }

    const allowedMimeTypes = ["image/png", "image/jpeg", "image/webp"];

    const maxFileSize = 10 * 1024 * 1024;

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimeType)) {
        const error = new Error(`Unsupported file type: ${file.mimeType}`);

        error.statusCode = 400;
        throw error;
      }

      if (file.fileSize > maxFileSize) {
        const error = new Error(
          `File ${file.originalFileName} exceeds the 10MB limit`,
        );

        error.statusCode = 400;
        throw error;
      }
    }

    const lastImage = await EmployeeHierarchyImage.findOne({
      where: {
        companyId: companyId,
      },
      order: [["sortOrder", "DESC"]],
      attributes: ["sortOrder"],
    });

    let nextSortOrder = lastImage ? lastImage.sortOrder + 1 : 1;

    const records = [];

    for (const file of files) {
      const image = await EmployeeHierarchyImage.create({
        companyId: companyId,
        originalFileName: file.originalFileName,
        fileUrl: file.fileUrl,
        storageKey: file.storageKey || null,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        sortOrder: nextSortOrder,
        isActive: true,
      });

      records.push({
        uuid: image.uuid,
        originalFileName: image.originalFileName,
        fileUrl: image.fileUrl,
        mimeType: image.mimeType,
        fileSize: image.fileSize,
        sortOrder: image.sortOrder,
      });

      nextSortOrder += 1;
    }

    logger.info("Employee hierarchy images uploaded successfully", {
      companyId: companyId,
      count: records.length,
    });

    return records;
  } catch (error) {
    logger.error("Failed to upload employee hierarchy images", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function deleteHierarchyImage(companyId, imageUuid) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!imageUuid) {
      const error = new Error("Image UUID is required");
      error.statusCode = 400;
      throw error;
    }

    const image = await EmployeeHierarchyImage.findOne({
      where: {
        uuid: imageUuid,
        companyId: companyId,
        isActive: true,
      },
    });

    if (!image) {
      const error = new Error("Hierarchy image not found");
      error.statusCode = 404;
      throw error;
    }

    await image.update({
      isActive: false,
    });

    logger.info("Employee hierarchy image deleted successfully", {
      companyId: companyId,
      imageUuid: imageUuid,
    });

    return true;
  } catch (error) {
    logger.error("Failed to delete employee hierarchy image", {
      companyId: companyId,
      imageUuid: imageUuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  getHierarchyImages,
  uploadHierarchyImages,
  deleteHierarchyImage,
};
