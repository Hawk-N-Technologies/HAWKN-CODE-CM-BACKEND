const Joi = require("joi");

// All admin HRMS endpoints are read-only GETs — these only validate the query string.

// ?date=YYYY-MM-DD (defaults to today)
const attendanceQuerySchema = Joi.object({
  date: Joi.string()
    .pattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .messages({ "string.pattern.base": "Date must be in YYYY-MM-DD format" }),
});

// ?status=PENDING|APPROVED|REJECTED
const leavesQuerySchema = Joi.object({
  status: Joi.string()
    .valid("PENDING", "APPROVED", "REJECTED")
    .messages({ "any.only": "Status must be PENDING, APPROVED or REJECTED" }),
});

// ?month=YYYY-MM (defaults to this month)
const payrollQuerySchema = Joi.object({
  month: Joi.string()
    .pattern(/^20\d{2}-(0[1-9]|1[0-2])$/)
    .messages({ "string.pattern.base": "Month must be in YYYY-MM format" }),
});

module.exports = {
  attendanceQuerySchema,
  leavesQuerySchema,
  payrollQuerySchema,
};