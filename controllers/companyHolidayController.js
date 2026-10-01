const companyHolidayService = require("../services/companyHolidayService");

async function createHoliday(req, res, next) {
  try {
    const companyId = req.user.companyId;

    const holiday = await companyHolidayService.createHoliday(
      companyId,
      req.body
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

    const holidays =
      await companyHolidayService.getAllHolidays(companyId);

    return res.status(200).json({
      success: true,
      message: "Holidays fetched successfully",
      data: holidays,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createHoliday,
  getAllHolidays,
};
