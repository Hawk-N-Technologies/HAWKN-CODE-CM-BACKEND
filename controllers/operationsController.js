const operationsService = require("../services/operationsService");

function getAuthenticatedUserId(req) {
  return req.user?.userId ?? req.user?.id ?? null;
}

function getCompanyId(req) {
  return Number(req.user?.companyId);
}

function isValidId(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

async function getApprovedProjects(req, res, next) {
  try {
    const companyId = getCompanyId(req);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authenticated company could not be identified.",
      });
    }

    const projects = await operationsService.getApprovedProjects(companyId);

    return res.status(200).json({
      success: true,
      message: "Client-approved projects fetched successfully.",
      data: projects,
    });
  } catch (error) {
    next(error);
  }
}

async function getOperationsOptions(req, res, next) {
  try {
    const companyId = getCompanyId(req);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authenticated company could not be identified.",
      });
    }

    const options = await operationsService.getOperationsOptions(companyId);

    return res.status(200).json({
      success: true,
      message: "Operations assignment options fetched successfully.",
      data: options,
    });
  } catch (error) {
    next(error);
  }
}

async function saveOperationsPlan(req, res, next) {
  try {
    const brdUuid = req.params.projectId;
    const companyId = getCompanyId(req);
    const userId = getAuthenticatedUserId(req);

    if (!brdUuid) {
      return res.status(400).json({
        success: false,
        message: "Invalid brd uu ID.",
      });
    }

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Authenticated company could not be identified.",
      });
    }
    const {
      leadId,
      testerId,
      developerIds,
      technologyStack,
      erDiagramStatus,
      flowchartStatus,
    } = req.body;

    const plan = await operationsService.saveOperationsPlan({
      brdUuid,
      companyId,
      userId,
      leadId,
      testerId,
      developerIds,
      technologyStack,
      erDiagramStatus,
      flowchartStatus,
    });

    return res.status(200).json({
      success: true,
      message: "Operations plan saved successfully.",
      data: plan,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyProjects(req, res, next) {
  try {
    const userId = req.user?.userId;
    const companyId = req.user?.companyId;

    const projects = await operationsService.getMyProjects(userId, companyId);

    return res.status(200).json({
      success: true,
      message: "Assigned projects fetched successfully.",
      data: projects,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}

module.exports = {
  getApprovedProjects,
  getOperationsOptions,
  saveOperationsPlan,
  getMyProjects,
};
