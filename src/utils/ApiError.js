/**
 * Throw this anywhere in a controller/service to send a clean error
 * response, e.g. `throw new ApiError(404, "Client not found.")`.
 */
export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details; // optional extra info (e.g. validation errors)
  }
}
