const CompanyRolesResponsibilities = require("../models/CompanyRolesResponsibilities");

const logger = require("../utils/logger");

// Max size of the rich-text HTML we accept (~500 KB of text)
const MAX_CONTENT_LENGTH = 500000;

// Only these fields go back to the frontend (never the internal id / companyId)
function toResponse(record) {
  return {
    uuid: record ? record.uuid : null,
    admin: record ? record.admin : "",
    hr: record ? record.hr : "",
    bde: record ? record.bde : "",
    client: record ? record.client : "",
    developer: record ? record.developer : "",
    tester: record ? record.tester : "",
    projectLead: record ? record.projectLead : "",
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

    let rolesResponsibilities = await CompanyRolesResponsibilities.findOne({
      where: {
        companyId: companyId,
      },
      attributes: [
        "uuid",
        "admin",
        "hr",
        "client",
        "tester",
        "bde",
        "developer",
        "projectLead",
        "createdAt",
        "updatedAt",
      ],
    });

    // Nothing saved yet is NOT an error — the page just shows an empty editor
    if (!rolesResponsibilities) {
      rolesResponsibilities = CompanyRolesResponsibilities.create({
        companyId: companyId,
        content: "",
      });
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

async function updateRolesResponsibilities(
  uuid,
  admin,
  hr,
  bde,
  client,
  tester,
  developer,
  projectLead,
) {
  try {
    if (!uuid) {
      const error = new Error("uuid is required");
      error.statusCode = 400;
      throw error;
    }

    if (typeof admin !== "string") {
      const error = new Error("Content must be a string");
      error.statusCode = 400;
      throw error;
    }

    if (admin.length > MAX_CONTENT_LENGTH) {
      const error = new Error("Content is too long");
      error.statusCode = 400;
      throw error;
    }

    let rolesResponsibilities = await CompanyRolesResponsibilities.findOne({
      where: {
        uuid: uuid,
      },
    });

    // First "Save Changes" ever → create the row (same pattern as company profile)
    if (!rolesResponsibilities) {
      rolesResponsibilities = await CompanyRolesResponsibilities.create({
        companyId: companyId,
        admin,
        hr,
        bde,
        client,
        tester,
        developer,
        projectLead,
      });

      logger.info("Roles and responsibilities created successfully", {
        companyId: companyId,
        contentUuid: rolesResponsibilities.uuid,
      });

      return toResponse(rolesResponsibilities);
    }

    // Every save after that → update the same row
    const res = await rolesResponsibilities.update({
      admin,
      hr,
      bde,
      client,
      tester,
      developer,
      projectLead,
    });

    logger.info("Roles and responsibilities updated successfully", {
      contentUuid: rolesResponsibilities.uuid,
    });

    return toResponse(rolesResponsibilities);
  } catch (error) {
    logger.error("Failed to update roles and responsibilities", {
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
