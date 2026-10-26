"use strict";

const CompanyProfile = require("../models/CompanyProfile");
const logger = require("../utils/logger");

function toProfileResponse(profile) {
  const data = profile.toJSON();

  return {
    uuid: data.uuid,
    officialCompanyName: data.officialCompanyName,
    officialEmail: data.officialEmail,
    vision: data.vision,
    mission: data.mission,

    // Backward compatibility with the existing frontend editor.
    blogContent: data.whatPeopleShouldKnow ?? "",

    // Keep all three existing blog sections available.
    whatPeopleShouldKnow: data.whatPeopleShouldKnow ?? "",
    whyCustomersShouldCare: data.whyCustomersShouldCare ?? "",
    cultureAndValues: data.cultureAndValues ?? "",

    companyStory: data.companyStory ?? "",
    companyStoryDocumentName: data.companyStoryDocumentName ?? null,
    companyStoryDocumentUrl: data.companyStoryDocumentPath
      ? `/api/company/profile/${data.uuid}/story-document`
      : null,

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function getCompanyProfile(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required.");
      error.statusCode = 400;
      throw error;
    }

    const profile = await CompanyProfile.findOne({
      where: { companyId },
      attributes: [
        "uuid",
        "officialCompanyName",
        "officialEmail",
        "vision",
        "mission",
        // "companyStoryDocumentPath",
        // "companyStoryDocumentName",
        "whatPeopleShouldKnow",
        "whyCustomersShouldCare",
        "cultureAndValues",
        "companyStory",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!profile) {
      const error = new Error("Company profile not found.");
      error.statusCode = 404;
      throw error;
    }

    return toProfileResponse(profile);
  } catch (error) {
    logger.error("Failed to fetch company profile", {
      companyId,
      error: error.message,
    });

    throw error;
  }
}

async function updateCompanyProfile(uuid, data, companyId) {
  try {
    if (!uuid) {
      const error = new Error("Profile UUID is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      const error = new Error("Profile data is required.");
      error.statusCode = 400;
      throw error;
    }

    const where = { uuid };

    if (companyId) {
      where.companyId = companyId;
    }

    const profile = await CompanyProfile.findOne({ where });

    if (!profile) {
      const error = new Error("Company profile not found.");
      error.statusCode = 404;
      throw error;
    }

    const updates = {};
    const acceptedFields = [
      "officialCompanyName",
      "officialEmail",
      "vision",
      "mission",
      "whatPeopleShouldKnow",
      "whyCustomersShouldCare",
      "cultureAndValues",
      "companyStory",
    ];

    for (const field of acceptedFields) {
      if (Object.prototype.hasOwnProperty.call(data, field)) {
        updates[field] = data[field];
      }
    }

    // Map the existing rich-text editor to its legacy database column.
    // Do not overwrite the other blog sections.
    if (
      Object.prototype.hasOwnProperty.call(data, "blogContent") &&
      !Object.prototype.hasOwnProperty.call(data, "whatPeopleShouldKnow")
    ) {
      updates.whatPeopleShouldKnow = data.blogContent;
    }

    await profile.update(updates);
    await profile.reload();

    return toProfileResponse(profile);
  } catch (error) {
    logger.error("Failed to update company profile", {
      profileUuid: uuid,
      error: error.message,
    });

    throw error;
  }
}

module.exports = {
  getCompanyProfile,
  updateCompanyProfile,
};
