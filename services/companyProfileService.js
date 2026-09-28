const CompanyProfile = require("../models/CompanyProfile");
const logger = require("../utils/logger");

async function getCompanyProfile(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const profile = await CompanyProfile.findOne({
      where: {
        companyId: companyId,
      },
      attributes: [
        "uuid",
        "officialCompanyName",
        "officialEmail",
        "vision",
        "mission",
        "blogContent",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!profile) {
      const error = new Error("Company profile not found");
      error.statusCode = 404;
      throw error;
    }

    logger.info("Company profile fetched successfully", {
      companyId: companyId,
      profileUuid: profile.uuid,
    });

    return profile;
  } catch (error) {
    logger.error("Failed to fetch company profile", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}
async function updateCompanyProfile(companyId, data) {
  try {
    console.log(companyId);

    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!data || typeof data !== "object") {
      const error = new Error("Profile data is required");
      error.statusCode = 400;
      throw error;
    }

    let profile = await CompanyProfile.findOne({
      where: {
        companyId: companyId,
      },
    });

    const allowedFields = {
      officialCompanyName: data.officialCompanyName,
      officialEmail: data.officialEmail,
      vision: data.vision,
      mission: data.mission,
      blogContent: data.blogContent,
    };

    // Create profile if it doesn't exist
    if (!profile) {
      profile = await CompanyProfile.create({
        companyId: companyId,
        ...allowedFields,
      });

      logger.info("Company profile created successfully", {
        companyId: companyId,
        profileUuid: profile.uuid,
      });

      return {
        uuid: profile.uuid,
        officialCompanyName: profile.officialCompanyName,
        officialEmail: profile.officialEmail,
        vision: profile.vision,
        mission: profile.mission,
        blogContent: profile.blogContent,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      };
    }

    // Update existing profile
    await profile.update(allowedFields);

    logger.info("Company profile updated successfully", {
      companyId: companyId,
      profileUuid: profile.uuid,
    });

    return {
      uuid: profile.uuid,
      officialCompanyName: profile.officialCompanyName,
      officialEmail: profile.officialEmail,
      vision: profile.vision,
      mission: profile.mission,
      blogContent: profile.blogContent,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  } catch (error) {
    logger.error("Failed to update company profile", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}
module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
};
