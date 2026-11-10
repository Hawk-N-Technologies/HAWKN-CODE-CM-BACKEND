const logger = require("../utils/logger");

function errorHandler(error, req, res, next) {
  logger.error("Unhandled application error", {
    method: req.method,
    path: req.originalUrl,
    error: error.message,
    stack: error.stack,
  });

  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message,
    // Field-level errors (e.g. { email: "Already exists" }) so forms can highlight them
    ...(error.details && { details: error.details }),
  });
}

module.exports = errorHandler;