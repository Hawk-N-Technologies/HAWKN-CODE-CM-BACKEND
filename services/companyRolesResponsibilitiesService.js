const CompanyRolesResponsibilities = require("../models/CompanyRolesResponsibilities");

const logger = require("../utils/logger");

// Max size of the rich-text HTML we accept (~500 KB of text)
const MAX_CONTENT_LENGTH = 500000;

// Only these fields go back to the frontend (never the internal id / companyId)
function toResponse(record) {
  return {
    uuid: record ? record.uuid : null,
    content: record ? record.content : "",
    createdAt: record ? record.createdAt : null,
    updatedAt: record ? record.updatedAt : null,
  };
}

async function getRolesResponsibilities(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const rolesResponsibilities = await CompanyRolesResponsibilities.findOne({
      where: {
        companyId: companyId,
      },
      attributes: ["uuid", "content", "createdAt", "updatedAt"],
    });

    // Nothing saved yet is NOT an error — the page just shows an empty editor
    if (!rolesResponsibilities) {
      logger.info("No roles and responsibilities saved yet", {
        companyId: companyId,
      });

      return toResponse(null);
    }

    logger.info("Roles and responsibilities fetched successfully", {
      companyId: companyId,
      contentUuid: rolesResponsibilities.uuid,
    });

    return toResponse(rolesResponsibilities);
  } catch (error) {
    logger.error("Failed to fetch roles and responsibilities", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function updateRolesResponsibilities(companyId, content) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (typeof content !== "string") {
      const error = new Error("Content must be a string");
      error.statusCode = 400;
      throw error;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      const error = new Error("Content is too long");
      error.statusCode = 400;
      throw error;
    }

    let rolesResponsibilities = await CompanyRolesResponsibilities.findOne({
      where: {
        companyId: companyId,
      },
    });

    // First "Save Changes" ever → create the row (same pattern as company profile)
    if (!rolesResponsibilities) {
      rolesResponsibilities = await CompanyRolesResponsibilities.create({
        companyId: companyId,
        content: content,
      });

      logger.info("Roles and responsibilities created successfully", {
        companyId: companyId,
        contentUuid: rolesResponsibilities.uuid,
      });

      return toResponse(rolesResponsibilities);
    }

    // Every save after that → update the same row
    await rolesResponsibilities.update({
      content: content,
    });

    logger.info("Roles and responsibilities updated successfully", {
      companyId: companyId,
      contentUuid: rolesResponsibilities.uuid,
    });

    return toResponse(rolesResponsibilities);
  } catch (error) {
    logger.error("Failed to update roles and responsibilities", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  getRolesResponsibilities,
  updateRolesResponsibilities,
};