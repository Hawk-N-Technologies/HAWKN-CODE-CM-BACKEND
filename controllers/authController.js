const authService = require("../services/authService");
const logger = require("../utils/logger");

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    res.cookie("access_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 30 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
      },
    });
  } catch (error) {
    logger.error("Login controller failed", {
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout controller failed", {
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;

    const user = await authService.getMe(userId);

    return res.status(200).json({
      success: true,
      message: "Authenticated user fetched successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    logger.error("Get authenticated user controller failed", {
      userId: req.user?.userId,
      error: error.message,
      stack: error.stack,
    });

    return next(error);
  }
}

async function getMyModes(req, res, next) {
  try {
    const { userId, companyId, role } = req.user;

    const modes = await authService.getAvailableModes(userId, companyId, role);

    return res.status(200).json({
      success: true,
      data: { modes },
    });
  } catch (error) {
    next(error);
  }
}

async function getMee(req, res, next) {
  try {
    const allowed = await authService.checkProjectLeadAccess(
      req.user.userId,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      data: { allowed },
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  login,
  logout,
  getMe,
  getMyModes,
  getMee,
};
