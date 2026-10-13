const authService = require("../services/authService");

async function requireProjectLead(req, res, next) {
  try {
    console.log(req.user);
    const allowed = await authService.checkProjectLeadAccess(
      req.user.userId,
      req.user.companyId,
    );

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Project lead access denied",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}

async function checkProjectLead(userId, companyId, projectId) {
  try {
    const allowed = await authService.checkProjectLeadAccess2(
      userId,
      companyId,
      projectId,
    );

    if (!allowed) {
      return false;
    }

    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

module.exports = { requireProjectLead, checkProjectLead };
