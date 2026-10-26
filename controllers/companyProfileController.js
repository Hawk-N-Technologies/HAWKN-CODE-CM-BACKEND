"use strict";

const fs = require("fs");
const path = require("path");

const companyProfileService = require("../services/companyProfileService");
const logger = require("../utils/logger");
const CompanyProfile = require("../models/CompanyProfile");
const { uploadDirectory } = require("../middleware/companyStoryUpload");

async function getCompanyProfile(req, res, next) {
  try {
    const profile = await companyProfileService.getCompanyProfile(
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Company profile fetched successfully.",
      data: profile,
    });
  } catch (error) {
    logger.error("Get company profile controller failed", {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message,
    });

    return next(error);
  }
}

async function updateCompanyProfile(req, res, next) {
  try {
    const profile = await companyProfileService.updateCompanyProfile(
      req.params.uuid,
      req.body,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully.",
      data: profile,
    });
  } catch (error) {
    logger.error("Update company profile controller failed", {
      profileUuid: req.params.uuid,
      error: error.message,
    });

    return next(error);
  }
}

async function uploadCompanyStoryDocument(req, res, next) {
  try {
    if (!req.file) {
      const error = new Error("Select a PDF, DOCX, or TXT file.");
      error.statusCode = 400;
      throw error;
    }

    const profile = await CompanyProfile.findOne({
      where: {
        uuid: req.params.uuid,
        companyId: req.user.companyId,
      },
    });

    if (!profile) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const error = new Error("Company profile not found.");
      error.statusCode = 404;
      throw error;
    }

    const previousPath = profile.companyStoryDocumentPath;
    const newRelativePath = path.relative(uploadDirectory, req.file.path);

    try {
      await profile.update({
        companyStoryDocumentPath: newRelativePath,
        companyStoryDocumentName: path.basename(req.file.originalname),
      });
    } catch (databaseError) {
      // Avoid leaving an orphaned new file when persistence fails.
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      throw databaseError;
    }

    // Remove the previous file only after the new database values persist.
    if (previousPath && previousPath !== newRelativePath) {
      const oldPath = path.resolve(uploadDirectory, previousPath);
      const relativeOldPath = path.relative(uploadDirectory, oldPath);

      if (
        relativeOldPath &&
        !relativeOldPath.startsWith("..") &&
        !path.isAbsolute(relativeOldPath) &&
        fs.existsSync(oldPath)
      ) {
        fs.unlinkSync(oldPath);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Company story document uploaded successfully.",
      data: {
        companyStoryDocumentName: profile.companyStoryDocumentName,
        companyStoryDocumentUrl:
          `/api/company/profile/${profile.uuid}/story-document`,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getCompanyStoryDocument(req, res, next) {
  try {
    const profile = await CompanyProfile.findOne({
      where: {
        uuid: req.params.uuid,
        companyId: req.user.companyId,
      },
      attributes: [
        "uuid",
        "companyStoryDocumentPath",
        "companyStoryDocumentName",
      ],
    });

    if (!profile) {
      const error = new Error("Company profile not found.");
      error.statusCode = 404;
      throw error;
    }

    if (!profile.companyStoryDocumentPath) {
      const error = new Error("No Our Story document has been uploaded.");
      error.statusCode = 404;
      throw error;
    }

    const absolutePath = path.resolve(
      uploadDirectory,
      profile.companyStoryDocumentPath,
    );
    const relativePath = path.relative(uploadDirectory, absolutePath);

    // Never serve a path outside uploads/company-stories.
    if (
      !relativePath ||
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      const error = new Error("Stored document path is invalid.");
      error.statusCode = 400;
      throw error;
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      const error = new Error(
        "The document record exists, but its file is missing from storage.",
      );
      error.statusCode = 404;
      throw error;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    const contentTypes = {
      ".pdf": "application/pdf",
      ".txt": "text/plain; charset=utf-8",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const contentType = contentTypes[extension];

    if (!contentType) {
      const error = new Error("Unsupported stored document type.");
      error.statusCode = 415;
      throw error;
    }

    const safeFilename = path
      .basename(profile.companyStoryDocumentName || "company-story")
      .replace(/["\r\n]/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "X-Content-Type-Options",
      "nosniff",
    );
    res.setHeader(
      "Content-Disposition",
      `${extension === ".docx" ? "attachment" : "inline"}; filename="${safeFilename}"`,
    );

    return res.sendFile(absolutePath, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
  uploadCompanyStoryDocument,
  getCompanyStoryDocument,
};
