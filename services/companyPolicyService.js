const CompanyPolicy = require("../models/CompanyPolicy");
const logger = require("../utils/logger");

async function getCompanyPolicies(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    let policies = await CompanyPolicy.findOne({
      where: {
        companyId: companyId,
      },
      attributes: [
        "uuid",
        "attendancePolicy",
        "leavePolicy",
        "codeOfConduct",
        "dataSecurityPolicy",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!policies) {
      policies = await CompanyPolicy.create({
        companyId,
        content: "",
      });
    }

    logger.info("Company policies fetched successfully", {
      companyId: companyId,
      policyUuid: policies.uuid,
    });

    return policies;
  } catch (error) {
    logger.error("Failed to fetch company policies", {
      companyId: companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function updateCompanyPolicies(
  uuid,
  leavePolicy,
  attendancePolicy,
  codeOfConduct,
  dataSecurityPolicy,
) {
  try {
    if (!uuid) {
      const error = new Error("uuid is required");
      error.statusCode = 400;
      throw error;
    }

    if (typeof leavePolicy !== "string") {
      const error = new Error("Policy content must be a string");
      error.statusCode = 400;
      throw error;
    }

    const policies = await CompanyPolicy.findOne({
      where: {
        uuid: uuid,
      },
    });

    if (!policies) {
      const error = new Error("Company policies not found");
      error.statusCode = 404;
      throw error;
    }

    await policies.update({
      dataSecurityPolicy,
      leavePolicy,
      codeOfConduct,
      attendancePolicy,
    });

    logger.info("Company policies updated successfully", {
      policyUuid: policies.uuid,
    });

    return {
      uuid: policies.uuid,
      attendancePolicy: policies.attendancePolicy,
      codeOfConduct: policies.codeOfConduct,
      leavePolicy: policies.leavePolicy,
      dataSecurityPolicy: policies.dataSecurityPolicy,
      createdAt: policies.createdAt,
      updatedAt: policies.updatedAt,
    };
  } catch (error) {
    logger.error("Failed to update company policies", {
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  getCompanyPolicies,
  updateCompanyPolicies,
};
