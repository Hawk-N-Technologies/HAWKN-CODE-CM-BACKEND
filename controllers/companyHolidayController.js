const companyHolidayService = require("../services/companyHolidayService");

async function createHoliday(req, res, next) {
  try {
    const companyId = req.user.companyId;

    const holiday = await companyHolidayService.createHoliday(
      companyId,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllHolidays(req, res, next) {
  try {
    const companyId = req.user.companyId;

    const {
      search = "",
      page = 1,
      limit = 10,
      sortBy = "holidayDate",
      sortOrder = "ASC",
    } = req.query;

    const result = await companyHolidayService.getAllHolidays(companyId, {
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Holidays fetched successfully",
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteHoliday(req, res, next) {
  try {
    const companyId = req.user.companyId;
    const { uuid } = req.params;

    const result = await companyHolidayService.deleteHoliday(companyId, uuid);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        uuid: result.uuid,
      },
    });
  } catch (error) {
    console.error("Delete company holiday controller failed:", error);

    next(error);
  }
}

module.exports = {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
};
