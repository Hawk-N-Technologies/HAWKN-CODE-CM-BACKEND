const Joi = require("joi");
const incrementService = require("../services/incrementService");
const logger = require("../utils/logger");

// companyId + userId always come from the login token, never from the request
const uuidSchema = Joi.string().guid().required();

async function listIncrements(req, res, next) {
  try {
    const records = await incrementService.listIncrements(req.user.companyId, req.validatedQuery);
    return res.status(200).json({ success: true, message: "Increments fetched successfully", data: records });
  } catch (error) {
    logger.error("List increments controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function createIncrement(req, res, next) {
  try {
    const record = await incrementService.createIncrement(req.user.companyId, req.user.userId, req.body);
    return res.status(201).json({
      success: true,
      message: "Increment applied — salary updated",
      data: record,
    });
  } catch (error) {
    logger.error("Create increment controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function revertIncrement(req, res, next) {
  try {
    if (uuidSchema.validate(req.params.uuid).error) {
      return res.status(400).json({ success: false, message: "Invalid increment ID" });
    }

    await incrementService.revertIncrement(req.params.uuid, req.user.companyId);
    return res.status(200).json({
      success: true,
      message: "Increment reverted — salary restored",
      data: null,
    });
  } catch (error) {
    logger.error("Revert increment controller failed", {
      userId: req.user?.userId,
      incrementUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

module.exports = {
  listIncrements,
  createIncrement,
  revertIncrement,
};