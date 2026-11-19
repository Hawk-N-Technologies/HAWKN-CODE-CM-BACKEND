const jwtService = require("../services/jwtService");
const { isSessionValid } = require("../services/sessionService");
const logger = require("../utils/logger");

function authenticate(allowedRoles) {
  return async function (req, res, next) {
    try {
      const token = req.cookies.access_token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const decoded = jwtService.verifyJwt(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      // Deactivated user, or password changed by HR/Admin since this login
      if (!(await isSessionValid(decoded))) {
        res.clearCookie("access_token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        });
        return res.status(401).json({
          success: false,
          message: "Your session has ended. Please log in again.",
        });
      }

      req.user = decoded; // Role authorization

      if (
        Array.isArray(allowedRoles) &&
        allowedRoles.length > 0 &&
        !allowedRoles.includes(decoded.role)
      ) {
        logger.warn("User does not have required role", {
          userId: decoded.userId,
          role: decoded.role,
          allowedRoles,
        });

        return res.status(403).json({
          success: false,
          message: "You do not have permission to access this resource",
        });
      }

      logger.info("User authenticated successfully", {
        userId: decoded.userId,
        companyId: decoded.companyId,
        role: decoded.role,
      });
      next();
    } catch (error) {
      logger.error("Authentication middleware failed", {
        error: error.message,
        stack: error.stack,
      });

      return res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
    }
  };
}

module.exports = authenticate;
