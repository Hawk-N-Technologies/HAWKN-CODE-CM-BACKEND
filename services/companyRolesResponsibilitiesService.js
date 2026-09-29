const CompanyRolesResponsibilities = require("../models/CompanyRolesResponsibilities");

const logger = require("../utils/logger");

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
      attributes: ["uuid", "content", "createdAt", "updatedAt"],
    });

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

async function updateRolesResponsibilities(uuid, content) {
  try {
    if (!uuid) {
      const error = new Error("uuid is required");
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
        uuid: uuid,
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
