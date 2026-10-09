const authService = require("../services/authService");

async function requireProjectLead(req, res, next) {
  try {
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

module.exports = requireProjectLead;
