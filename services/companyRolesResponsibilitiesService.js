const CompanyRolesResponsibilities = require("../models/CompanyRolesResponsibilities");

const logger = require("../utils/logger");

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

    if (!rolesResponsibilities) {
      const error = new Error("Roles and responsibilities not found");

      error.statusCode = 404;
      throw error;
    }

    logger.info("Roles and responsibilities fetched successfully", {
      companyId: companyId,
      contentUuid: rolesResponsibilities.uuid,
    });

    return rolesResponsibilities;
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

    const rolesResponsibilities = await CompanyRolesResponsibilities.findOne({
      where: {
        companyId: companyId,
      },
    });

    if (!rolesResponsibilities) {
      const error = new Error("Roles and responsibilities not found");

      error.statusCode = 404;
      throw error;
    }

    await rolesResponsibilities.update({
      content: content,
    });

    logger.info("Roles and responsibilities updated successfully", {
      companyId: companyId,
      contentUuid: rolesResponsibilities.uuid,
    });

    return {
      uuid: rolesResponsibilities.uuid,
      content: rolesResponsibilities.content,
      createdAt: rolesResponsibilities.createdAt,
      updatedAt: rolesResponsibilities.updatedAt,
    };
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
