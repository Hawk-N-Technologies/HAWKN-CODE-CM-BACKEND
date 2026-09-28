const { Company } = require("../models");
const logger = require("../utils/logger");

async function getAllCompanies() {
  try {
    const companies = await Company.findAll({
      attributes: ["uuid", "name", "createdAt", "updatedAt"],

      order: [["createdAt", "DESC"]],
    });

    logger.info("Companies fetched successfully", {
      count: companies.length,
    });

    return companies;
  } catch (error) {
    logger.error("Failed to fetch companies", {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getCompanyByUuid(companyUuid) {
  try {
    if (!companyUuid) {
      const error = new Error("Company UUID is required");
      error.statusCode = 400;
      throw error;
    }

    const company = await Company.findOne({
      where: {
        uuid: companyUuid,
      },

      attributes: ["uuid", "name", "createdAt", "updatedAt"],
    });

    if (!company) {
      const error = new Error("Company not found");
      error.statusCode = 404;
      throw error;
    }

    logger.info("Company fetched successfully", {
      companyUuid,
    });

    return company;
  } catch (error) {
    logger.error("Failed to fetch company", {
      companyUuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  getAllCompanies,
  getCompanyByUuid,
};
