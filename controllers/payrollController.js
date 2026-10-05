const Joi = require("joi");
const payrollService = require("../services/payrollService");
const logger = require("../utils/logger");

// companyId + userId always come from the login token, never from the request
const uuidSchema = Joi.string().guid().required();

async function searchEmployees(req, res, next) {
  try {
    const employees = await payrollService.searchEmployees(
      req.user.companyId,
      req.validatedQuery.q,
    );

    return res.status(200).json({
      success: true,
      message: "Employees fetched successfully",
      data: employees,
    });
  } catch (error) {
    logger.error("Payroll employee search controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function listPayroll(req, res, next) {
  try {
    const records = await payrollService.listPayroll(req.user.companyId, req.validatedQuery);

    return res.status(200).json({
      success: true,
      message: "Payroll fetched successfully",
      data: records,
    });
  } catch (error) {
    logger.error("List payroll controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function createPayroll(req, res, next) {
  try {
    const record = await payrollService.createPayroll(
      req.user.companyId,
      req.user.userId,
      req.body, // already cleaned by validate(createPayrollSchema)
    );

    return res.status(201).json({
      success: true,
      message: "Payroll created successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Create payroll controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function processPayroll(req, res, next) {
  try {
    // Bad UUID → clean 400 (Sequelize would otherwise crash with a 500)
    if (uuidSchema.validate(req.params.uuid).error) {
      return res.status(400).json({ success: false, message: "Invalid payroll ID" });
    }

    const record = await payrollService.processPayroll(
      req.params.uuid,
      req.user.companyId,
      req.user.userId,
    );

    return res.status(200).json({
      success: true,
      message: "Payroll processed successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Process payroll controller failed", {
      userId: req.user?.userId,
      payrollUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

async function updatePayroll(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return res.status(400).json({ success: false, message: "Invalid payroll ID" });
    }

    const record = await payrollService.updatePayroll(
      req.params.uuid,
      req.user.companyId,
      req.body, // already cleaned by validate(updatePayrollSchema)
    );

    return res.status(200).json({
      success: true,
      message: "Payroll updated successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Update payroll controller failed", {
      userId: req.user?.userId,
      payrollUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

async function deletePayroll(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return res.status(400).json({ success: false, message: "Invalid payroll ID" });
    }

    await payrollService.deletePayroll(req.params.uuid, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Payroll deleted successfully",
      data: null,
    });
  } catch (error) {
    logger.error("Delete payroll controller failed", {
      userId: req.user?.userId,
      payrollUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

module.exports = {
  searchEmployees,
  listPayroll,
  createPayroll,
  processPayroll,
  updatePayroll,
  deletePayroll,
};