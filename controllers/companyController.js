const companyService = require("../services/companyService");
const logger = require("../utils/logger");

async function getAllCompanies(req, res, next) {
  try {
    logger.info("Get all companies request received");

    const companies = await companyService.getAllCompanies();

    return res.status(200).json({
      success: true,
      message: "Companies fetched successfully",
      data: companies,
    });
  } catch (error) {
    logger.error("Get all companies controller failed", {
      error: error.message,
    });

    return next(error);
  }
}

async function getCompany(req, res, next) {
  try {
    const { uuid } = req.params;

    logger.info("Get company request received", {
      companyUuid: uuid,
    });

    const company = await companyService.getCompanyByUuid(uuid);

    return res.status(200).json({
      success: true,
      message: "Company fetched successfully",
      data: company,
    });
  } catch (error) {
    logger.error("Get company controller failed", {
      companyUuid: req.params.uuid,
      error: error.message,
    });

    return next(error);
  }
}

module.exports = {
  getAllCompanies,
  getCompany,
};
