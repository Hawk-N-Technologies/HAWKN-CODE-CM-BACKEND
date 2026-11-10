const Attendance = require("../models/Attendance");
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

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(holidayDate)) {
      const error = new Error("Invalid holiday date format");
      error.statusCode = 400;
      throw error;
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Do not allow past holidays
    if (holidayDate < today) {
      const error = new Error("Holiday date cannot be in the past");
      error.statusCode = 400;
      throw error;
    }

    if (holidayDate === today) {
      const existingAttendance = await Attendance.findOne({
        where: {
          companyId,
          attendanceDate: today,
        },
      });

      if (existingAttendance) {
        const error = new Error(
          "A holiday cannot be created for today because attendance has already been marked.",
        );
        error.statusCode = 409;
        throw error;
      }
    }
    // Check duplicate holiday for same company/date
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

async function getAllHolidays(
  companyId,
  {
    search = "",
    page = 1,
    limit = 10,
    sortBy = "holidayDate",
    sortOrder = "ASC",
  } = {},
) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Pagination
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (currentPage - 1) * pageSize;

    // Search
    const where = {
      companyId,
    };

    if (search.trim()) {
      where.name = {
        [Op.iLike]: `%${search.trim()}%`,
      };
    }

    // Sorting whitelist
    const allowedSortFields = ["holidayDate", "name", "createdAt", "updatedAt"];

    const sortField = allowedSortFields.includes(sortBy)
      ? sortBy
      : "holidayDate";

    const sortDirection =
      String(sortOrder).toUpperCase() === "DESC" ? "DESC" : "ASC";

    // Fetch holidays
    const { count, rows } = await CompanyHoliday.findAndCountAll({
      where,

      attributes: [
        "uuid",
        "holidayDate",
        "name",
        "isPaid",
        "createdAt",
        "updatedAt",
      ],

      order: [[sortField, sortDirection]],

      limit: pageSize,
      offset,
    });

    logger.info("Company holidays fetched successfully", {
      companyId,
      count,
      page: currentPage,
      limit: pageSize,
      search,
    });

    return {
      rows,
      pagination: {
        total: count,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  } catch (error) {
    logger.error("Failed to fetch company holidays", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function deleteHoliday(companyId, uuid) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!uuid) {
      const error = new Error("Holiday UUID is required");
      error.statusCode = 400;
      throw error;
    }

    const holiday = await CompanyHoliday.findOne({
      where: {
        companyId,
        uuid,
      },
    });

    if (!holiday) {
      const error = new Error("Company holiday not found");
      error.statusCode = 404;
      throw error;
    }

    // Get today's date as YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    // Prevent deletion of past holidays
    if (holiday.holidayDate < today) {
      const error = new Error("Past holidays cannot be deleted");
      error.statusCode = 400;
      throw error;
    }

    await holiday.destroy();

    logger.info("Company holiday deleted successfully", {
      holidayUuid: uuid,
      holidayId: holiday.id,
      companyId,
    });

    return {
      uuid,
      message: "Company holiday deleted successfully",
    };
  } catch (error) {
    logger.error("Failed to delete company holiday", {
      companyId,
      holidayUuid: uuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

module.exports = {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
};
