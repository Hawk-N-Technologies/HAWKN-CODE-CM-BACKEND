import { ApiError } from "../utils/ApiError.js";

// Runs when no route matched — turns it into a normal 404 error.
export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};
