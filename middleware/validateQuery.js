/**
 * Like validate.js, but for the URL query string (?startDate=...&q=...).
 * Express 5 makes req.query read-only, so the cleaned values go on
 * req.validatedQuery instead. Same error format as validate.js.
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed.",
        errors: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }

    req.validatedQuery = value;

    next();
  };
};

module.exports = validateQuery;