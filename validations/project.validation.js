const Joi = require("joi");

// Must match the CHECK constraints on the projects table (database.sql)
const TIERS = ["Tier I", "Tier II", "Tier III"];
const STATUSES = ["Planning", "In Development", "Testing", "Completed", "On Hold", "Cancelled"];

const optionalDate = (label) =>
  Joi.date().iso().allow(null, "").messages({
    "date.base": `${label} must be a valid date`,
    "date.format": `${label} must be YYYY-MM-DD`,
  });

// Create + edit use the same body (edit sends every field again)
const projectSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required().messages({
    "string.empty": "Project name is required",
    "any.required": "Project name is required",
    "string.min": "Project name is too short",
    "string.max": "Project name is too long (max 255)",
  }),

  clientUuid: Joi.string().guid().required().messages({
    "any.required": "Select a client",
    "string.empty": "Select a client",
    "string.guid": "Select a client from the list",
  }),

  // Optional — a project can start without a lead
  projectLeadUuid: Joi.string().guid().allow(null, "").messages({
    "string.guid": "Select a project lead from the list",
  }),

  tier: Joi.string()
    .valid(...TIERS)
    .default("Tier I")
    .messages({ "any.only": `Tier must be one of: ${TIERS.join(", ")}` }),

  startDate: optionalDate("Start date"),
  deadline: optionalDate("Deadline"),
  internalDeadline: optionalDate("Internal deadline"),

  status: Joi.string()
    .valid(...STATUSES)
    .default("Planning")
    .messages({ "any.only": `Status must be one of: ${STATUSES.join(", ")}` }),

  progress: Joi.number().integer().min(0).max(100).default(0).messages({
    "number.base": "Progress must be a number",
    "number.integer": "Progress must be a whole number",
    "number.min": "Progress can't be below 0%",
    "number.max": "Progress can't be above 100%",
  }),

  description: Joi.string().trim().max(5000).allow("", null).messages({
    "string.max": "Description is too long (max 5000)",
  }),
})
  // Express 5 leaves req.body undefined when nothing is sent → reject that too
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

const listProjectsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .messages({ "any.only": `Status must be one of: ${STATUSES.join(", ")}` }),
});

module.exports = {
  TIERS,
  STATUSES,
  projectSchema,
  listProjectsQuerySchema,
};