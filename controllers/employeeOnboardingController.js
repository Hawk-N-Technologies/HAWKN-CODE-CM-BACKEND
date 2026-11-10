const employeeOnboardingService = require("../services/employeeOnboardingService");
const logger = require("../utils/logger");

// companyId always comes from the logged-in user (JWT), never from the request body

async function getOnboardableRoles(req, res, next) {
  try {
    const roles = await employeeOnboardingService.getOnboardableRoles();

    return res.status(200).json({
      success: true,
      message: "Roles fetched successfully",
      data: roles,
    });
  } catch (error) {
    logger.error("Get onboardable roles controller failed", { error: error.message });
    return next(error);
  }
}

async function listOnboarding(req, res, next) {
  try {
    const records = await employeeOnboardingService.listOnboarding(req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Onboarding records fetched successfully",
      data: records,
    });
  } catch (error) {
    logger.error("List onboarding controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function startOnboarding(req, res, next) {
  try {
    const record = await employeeOnboardingService.startOnboarding(
      req.user.companyId,
      req.body || {}, // Express 5: req.body is undefined when no JSON is sent
    );

    return res.status(201).json({
      success: true,
      message: "Onboarding started successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Start onboarding controller failed", {
      userId: req.user?.userId,
      error: error.message,
    });
    return next(error);
  }
}

async function updateChecklistItem(req, res, next) {
  try {
    const record = await employeeOnboardingService.updateChecklistItem(
      req.params.uuid,
      req.user.companyId,
      req.body || {},
    );

    return res.status(200).json({
      success: true,
      message: "Checklist updated successfully",
      data: record,
    });
  } catch (error) {
    logger.error("Update onboarding checklist controller failed", {
      userId: req.user?.userId,
      onboardingUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

async function cancelOnboarding(req, res, next) {
  try {
    await employeeOnboardingService.cancelOnboarding(req.params.uuid, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Onboarding cancelled successfully",
      data: null,
    });
  } catch (error) {
    logger.error("Cancel onboarding controller failed", {
      userId: req.user?.userId,
      onboardingUuid: req.params.uuid,
      error: error.message,
    });
    return next(error);
  }
}

module.exports = {
  getOnboardableRoles,
  listOnboarding,
  startOnboarding,
  updateChecklistItem,
  cancelOnboarding,
};