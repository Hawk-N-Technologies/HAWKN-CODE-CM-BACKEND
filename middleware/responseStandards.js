"use strict";

/**
 * One response format for every endpoint, without touching each controller:
 *
 *  1. Adds `success` when a JSON response forgot it
 *     (true for 2xx/3xx, false for 4xx/5xx).
 *  2. Never sends internal error details to the browser: any 5xx response,
 *     or any response carrying raw database error text, becomes a safe
 *     generic 500. The real error is logged.
 *
 * Only plain-object JSON bodies are touched (arrays, files, streams are not).
 */

const logger = require("../utils/logger");

const SAFE_SERVER_MESSAGE = "Something went wrong. Please try again.";

// Raw database / ORM error text — never meant for users. Only distinctive
// Postgres/Sequelize phrases, so normal messages ("Project not found") pass.
const DB_ERROR_TEXT =
  /(relation|column) "[^"]+" (of relation "[^"]+" )?does not exist|violates (foreign key|unique|check|not-null) constraint|duplicate key value violates|invalid input (syntax|value) for|null value in column|syntax error at or near|operator does not exist|value too long for type|out of range for type|date\/time field value out of range|current transaction is aborted|^Sequelize\w*Error|notNull Violation/i;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function responseStandards(req, res, next) {
  const sendJson = res.json.bind(res);

  res.json = (body) => {
    if (!isPlainObject(body)) return sendJson(body);

    // A raw database error slipped into a response (any status) → treat as 500
    if (typeof body.message === "string" && DB_ERROR_TEXT.test(body.message)) {
      logger.error("Database error reached a response — hidden", {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        hiddenMessage: body.message,
      });

      res.status(500);
      return sendJson({ success: false, message: SAFE_SERVER_MESSAGE });
    }

    if (res.statusCode >= 500) {
      if (body.message && body.message !== SAFE_SERVER_MESSAGE) {
        logger.warn("Hid internal error message from response", {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          hiddenMessage: body.message,
        });
      }

      return sendJson({ success: false, message: SAFE_SERVER_MESSAGE });
    }

    if (body.success === undefined) {
      return sendJson({ success: res.statusCode < 400, ...body });
    }

    return sendJson(body);
  };

  next();
}

module.exports = responseStandards;