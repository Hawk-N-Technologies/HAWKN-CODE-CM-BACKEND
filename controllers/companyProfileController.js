const companyProfileService = require("../services/companyProfileService");
const logger = require("../utils/logger");
const CompanyProfile = require("../models/CompanyProfile");
const path = require("path");
const {
  uploadDirectory,
} = require("../middleware/companyStoryUpload");

async function getCompanyProfile(req, res, next) {
  try {
    const companyId = req.user.companyId;
    console.log(req.user);

    logger.info("Get company profile request received", {
      companyId,
    });

    const profile = await companyProfileService.getCompanyProfile(companyId);

    return res.status(200).json({
      success: true,
      message: "Company profile fetched successfully",
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
    const { uuid } = req.params;

    // logger.info("Update company profile request received", {
    //   profileUuid: uuid,
    // });
    const profile = await companyProfileService.updateCompanyProfile(
      uuid,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      data: profile,
    });
  } catch (error) {
    logger.error("Update company profile controller failed", {
      profileUuid: req.params.uuid,
      error: error.message,
      stack: error.stack,
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
      const error = new Error("Company profile not found.");
      error.statusCode = 404;
      throw error;
    }

    const previousPath = profile.companyStoryDocumentPath;

    await profile.update({
      companyStoryDocumentPath: path.relative(
        uploadDirectory,
        req.file.path,
      ),
      companyStoryDocumentName: path.basename(req.file.originalname),
    });

    // Delete the old stored file only after the database update succeeds.
    if (previousPath && previousPath !== profile.companyStoryDocumentPath) {
      const fs = require("fs");
      const oldPath = path.join(uploadDirectory, previousPath);

      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    return res.status(200).json({
      success: true,
      message: "Company story document uploaded successfully.",
      data: {
        companyStoryDocumentName: profile.companyStoryDocumentName,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
  uploadCompanyStoryDocument,
};
