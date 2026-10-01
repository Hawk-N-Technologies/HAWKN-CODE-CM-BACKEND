const CompanyHoliday = require("../models/CompanyHoliday");
const logger = require("../utils/logger");

async function createHoliday(companyId, data) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!data || typeof data !== "object") {
      const error = new Error("Holiday data is required");
      error.statusCode = 400;
      throw error;
    }

    const { holidayDate, name, isPaid = true } = data;

    if (!holidayDate) {
      const error = new Error("Holiday date is required");
      error.statusCode = 400;
      throw error;
    }

    if (!name || !name.trim()) {
      const error = new Error("Holiday name is required");
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate holiday for the same company/date
    const existingHoliday = await CompanyHoliday.findOne({
      where: {
        companyId,
        holidayDate,
      },
    });

    if (existingHoliday) {
      const error = new Error("A holiday already exists for this date");
      error.statusCode = 409;
      throw error;
    }

    const holiday = await CompanyHoliday.create({
      companyId,
      holidayDate,
      name: name.trim(),
      isPaid,
    });

    logger.info("Company holiday created successfully", {
      holidayId: holiday.id,
      holidayUuid: holiday.uuid,
      companyId,
      holidayDate,
    });

    return holiday;
  } catch (error) {
    logger.error("Failed to create company holiday", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getAllHolidays(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const holidays = await CompanyHoliday.findAll({
      where: {
        companyId,
      },

      attributes: [
        "uuid",
        "holidayDate",
        "name",
        "isPaid",
        "createdAt",
        "updatedAt",
      ],

      order: [["holidayDate", "ASC"]],
    });

    logger.info("Company holidays fetched successfully", {
      companyId,
      count: holidays.length,
    });

    return holidays;
  } catch (error) {
    logger.error("Failed to fetch company holidays", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  createHoliday,
  getAllHolidays,
};
