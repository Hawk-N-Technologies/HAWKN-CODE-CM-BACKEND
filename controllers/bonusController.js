const Joi = require("joi");
const bonusService = require("../services/bonusService");
const logger = require("../utils/logger");

// companyId + userId always come from the login token, never from the request
const uuidSchema = Joi.string().guid().required();

async function listBonuses(req, res, next) {
  try {
    const records = await bonusService.listBonuses(req.user.companyId, req.validatedQuery);
    return res.status(200).json({ success: true, message: "Bonuses fetched successfully", data: records });
  } catch (error) {
    logger.error("List bonuses controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function createBonus(req, res, next) {
  try {
    const record = await bonusService.createBonus(req.user.companyId, req.user.userId, req.body);
    return res.status(201).json({ success: true, message: "Bonus added successfully", data: record });
  } catch (error) {
    logger.error("Create bonus controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

async function deleteBonus(req, res, next) {
  try {
    // Bad UUID → clean 400 (Sequelize would otherwise crash with a 500)
    if (uuidSchema.validate(req.params.uuid).error) {
      return res.status(400).json({ success: false, message: "Invalid bonus ID" });
    }

    await bonusService.deleteBonus(req.params.uuid, req.user.companyId);
    return res.status(200).json({ success: true, message: "Bonus deleted successfully", data: null });
  } catch (error) {
    logger.error("Delete bonus controller failed", {
      userId: req.user?.userId,
      bonusUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

// Payroll form auto-fill: total bonus for one employee + month
async function getBonusTotal(req, res, next) {
  try {
    const data = await bonusService.getBonusTotal(req.user.companyId, req.validatedQuery);
    return res.status(200).json({ success: true, message: "Bonus total fetched successfully", data });
  } catch (error) {
    logger.error("Bonus total controller failed", { userId: req.user?.userId, error: error.message });
    return next(error);
  }
}

module.exports = {
  listBonuses,
  createBonus,
  deleteBonus,
  getBonusTotal,
};