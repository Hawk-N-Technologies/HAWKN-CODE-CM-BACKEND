const Joi = require("joi");
const internshipProbationService = require("../services/internshipProbationService");
const logger = require("../utils/logger");

// companyId + userId always come from the login token, never from the request
const uuidSchema = Joi.string().guid().required();

// Bad UUID in the URL → clean 400 (Sequelize would otherwise crash with a 500)
const invalidId = (res) => res.status(400).json({ success: false, message: "Invalid record ID" });

async function listPeriods(req, res, next) {
  try {
    const records = await internshipProbationService.listPeriods(req.user.companyId, req.validatedQuery);
    return res.status(200).json({ success: true, message: "Records fetched successfully", data: records });
  } catch (error) {
    logger.error("List internship/probation controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function createPeriod(req, res, next) {
  try {
    const record = await internshipProbationService.createPeriod(req.user.companyId, req.user.userId, req.body);
    return res.status(201).json({
      success: true,
      message: `${record.periodType} started for ${record.employee.fullName}`,
      data: record,
    });
  } catch (error) {
    logger.error("Create internship/probation controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function reviewPeriod(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    const record = await internshipProbationService.reviewPeriod(req.params.uuid, req.user.companyId, req.body);
    return res.status(200).json({ success: true, message: "Review saved", data: record });
  } catch (error) {
    logger.error("Review internship/probation controller failed", {
      userId: req.user?.userId,
      uuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

async function extendPeriod(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    const record = await internshipProbationService.extendPeriod(req.params.uuid, req.user.companyId, req.body);
    return res.status(200).json({ success: true, message: `Extended to ${record.endDate}`, data: record });
  } catch (error) {
    logger.error("Extend internship/probation controller failed", {
      userId: req.user?.userId,
      uuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

const CLOSE_MESSAGES = {
  Confirmed: "Confirmed — employee is now Full Time",
  Converted: "Internship closed — probation started",
  Ended: "Internship ended — employee marked as exited",
  Terminated: "Terminated — employee marked as exited",
};

async function closePeriod(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) return invalidId(res);
    const result = await internshipProbationService.closePeriod(
      req.params.uuid,
      req.user.companyId,
      req.user.userId,
      req.body,
    );
    return res.status(200).json({ success: true, message: CLOSE_MESSAGES[req.body.outcome], data: result });
  } catch (error) {
    logger.error("Close internship/probation controller failed", {
      userId: req.user?.userId,
      uuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

module.exports = {
  listPeriods,
  createPeriod,
  reviewPeriod,
  extendPeriod,
  closePeriod,
};