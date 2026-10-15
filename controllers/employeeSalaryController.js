const employeeSalaryService = require("../services/employeeSalaryService");
const payrollService = require("../services/payrollService");
const logger = require("../utils/logger");

// companyId always comes from the login token, never from the request

// Autocomplete for Salary Structure — only people with an employee record
async function searchEmployees(req, res, next) {
  try {
    const employees = await payrollService.searchEmployees(
      req.user.companyId,
      req.validatedQuery.q,
      { onlyEmployees: true },
    );

    return res.status(200).json({
      success: true,
      message: "Employees fetched successfully",
      data: employees,
    });
  } catch (error) {
    logger.error("Salary employee search controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function listSalaries(req, res, next) {
  try {
    const records = await employeeSalaryService.listSalaries(
      req.user.companyId,
      req.validatedQuery,
    );

    return res.status(200).json({
      success: true,
      message: "Salary structure fetched successfully",
      data: records,
    });
  } catch (error) {
    logger.error("List salaries controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function setSalary(req, res, next) {
  try {
    const { record, created } = await employeeSalaryService.setSalary(
      req.user.companyId,
      req.body,
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "Salary added successfully"
        : "Salary updated successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Set salary controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

const getPayrollCalculation = async (req, res, next) => {
  try {
    const { userUuid, payPeriod } = req.body;

    const companyId = req.user.companyId;

    const result = await employeeSalaryService.calculatePayroll({
      companyId,
      userUuid,
      payPeriod,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to calculate payroll:", error);

    return next(error);
  }
};

module.exports = {
  searchEmployees,
  listSalaries,
  setSalary,
  getPayrollCalculation,
};
