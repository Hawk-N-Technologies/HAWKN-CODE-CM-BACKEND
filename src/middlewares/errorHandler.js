import { env } from "../config/env.js";

/**
 * Central error handler — Express knows it's an error handler because
 * it takes 4 args. Every error in the app ends up here.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode ?? 500;

  // Log full error server-side only
  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    // Hide internal crash messages from users in production
    message: statusCode >= 500 && env.isProd ? "Something went wrong." : err.message,
    ...(err.details && { details: err.details }),
    ...(!env.isProd && statusCode >= 500 && { stack: err.stack }),
  });
};
