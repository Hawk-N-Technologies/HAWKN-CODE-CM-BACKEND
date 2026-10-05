const Joi = require("joi");

const PERIOD_TYPES = ["Internship", "Probation"];
const PERFORMANCE = ["Pending", "Needs Improvement", "Good", "Excellent"];
const STATUSES = ["Active", "Confirmed", "Converted", "Ended", "Terminated"];
// How HR can close an active period
const OUTCOMES = ["Confirmed", "Converted", "Ended", "Terminated"];
const MAX_STIPEND = 10000000;

const isoDate = (label) =>
  Joi.date().iso().messages({
    "date.base": `${label} must be a valid date`,
    "date.format": `${label} must be YYYY-MM-DD`,
    "any.required": `${label} is required`,
  });

const notes = () =>
  Joi.string().trim().max(1000).allow("", null).messages({ "string.max": "Notes are too long (max 1000)" });

const stipend = () =>
  Joi.number().min(0).max(MAX_STIPEND).precision(2).allow(null).messages({
    "number.base": "Stipend must be a number",
    "number.min": "Stipend can't be negative",
    "number.max": "Stipend is too large",
  });

// Express 5 leaves req.body undefined when nothing is sent → reject that too
const bodyRules = (schema) =>
  schema
    .required()
    .messages({ "any.required": "Request body is required" })
    .prefs({ errors: { wrap: { label: false } } });

// Start an internship / probation
const createPeriodSchema = bodyRules(
  Joi.object({
    userUuid: Joi.string().guid().required().messages({
      "any.required": "Select an employee",
      "string.empty": "Select an employee",
      "string.guid": "Select an employee from the suggestions",
    }),
    periodType: Joi.string()
      .valid(...PERIOD_TYPES)
      .required()
      .messages({ "any.only": "Type must be Internship or Probation" }),
    startDate: isoDate("Start date").required(),
    endDate: isoDate("End date")
      .required()
      .greater(Joi.ref("startDate"))
      .messages({ "date.greater": "End date must be after the start date" }),
    stipend: stipend(),
    performance: Joi.string()
      .valid(...PERFORMANCE)
      .default("Pending")
      .messages({ "any.only": `Performance must be one of: ${PERFORMANCE.join(", ")}` }),
    notes: notes(),
  }),
);

// Review: performance / notes / stipend (active periods only)
const reviewPeriodSchema = bodyRules(
  Joi.object({
    performance: Joi.string()
      .valid(...PERFORMANCE)
      .required()
      .messages({
        "any.only": `Performance must be one of: ${PERFORMANCE.join(", ")}`,
        "any.required": "Performance is required",
      }),
    notes: notes(),
    stipend: stipend(),
  }),
);

// Extend: push the end date out
const extendPeriodSchema = bodyRules(
  Joi.object({
    newEndDate: isoDate("New end date").required(),
    notes: notes(),
  }),
);

// Close with an outcome. "Converted" (intern → probation) needs the probation end date.
const closePeriodSchema = bodyRules(
  Joi.object({
    outcome: Joi.string()
      .valid(...OUTCOMES)
      .required()
      .messages({ "any.only": `Outcome must be one of: ${OUTCOMES.join(", ")}` }),
    notes: notes(),
    probationEndDate: isoDate("Probation end date")
      .when("outcome", {
        is: "Converted",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({ "any.unknown": "Probation end date is only used when moving an intern to probation" }),
  }),
);

const listPeriodsQuerySchema = Joi.object({
  periodType: Joi.string()
    .valid(...PERIOD_TYPES)
    .messages({ "any.only": "Type must be Internship or Probation" }),
  status: Joi.string()
    .valid(...STATUSES)
    .messages({ "any.only": `Status must be one of: ${STATUSES.join(", ")}` }),
  userUuid: Joi.string().guid().messages({ "string.guid": "Invalid employee" }),
});

module.exports = {
  PERIOD_TYPES,
  PERFORMANCE,
  OUTCOMES,
  createPeriodSchema,
  reviewPeriodSchema,
  extendPeriodSchema,
  closePeriodSchema,
  listPeriodsQuerySchema,
};