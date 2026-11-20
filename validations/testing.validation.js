const Joi = require("joi");

// http(s) links only — no javascript:, file:, etc.
const optionalLink = (label) =>
  Joi.string()
    .trim()
    .max(500)
    .uri({ scheme: ["http", "https"] })
    .allow("", null)
    .messages({
      "string.uri": `${label} must be a full http(s) link`,
      "string.uriCustomScheme": `${label} must be a full http(s) link`,
      "string.max": `${label} is too long (max 500)`,
    });

const projectId = Joi.string().guid().required().messages({
  "string.guid": "Pick a project",
  "string.empty": "Pick a project",
  "any.required": "Pick a project",
});

// A note is required when something failed / was rejected
const noteWhen = (field, values, label) =>
  Joi.string()
    .trim()
    .max(2000)
    .allow("", null)
    .when(field, {
      is: Joi.valid(...values),
      then: Joi.string().trim().min(3).required(),
    })
    .messages({
      "string.empty": label,
      "string.min": label,
      "any.required": label,
      "string.max": "Note is too long (max 2000)",
    });

// ---- Build Testing --------------------------------------------------------
const createBuildSchema = Joi.object({
  projectId,
  versionLabel: Joi.string().trim().min(1).max(50).required().messages({
    "string.empty": "Version is required",
    "any.required": "Version is required",
    "string.max": "Version is too long (max 50)",
  }),
  environment: Joi.string().valid("QA", "Staging", "Production").default("QA").messages({
    "any.only": "Pick a valid environment",
  }),
  buildUrl: optionalLink("Build link"),
  releaseNotes: Joi.string().trim().max(5000).allow("", null).messages({
    "string.max": "Release notes are too long (max 5000)",
  }),
});

const buildResultSchema = Joi.object({
  result: Joi.string().valid("Passed", "Failed").required().messages({
    "any.only": "Pick Passed or Failed",
    "any.required": "Pick Passed or Failed",
  }),
  testNotes: noteWhen("result", ["Failed"], "Say what failed"),
});

// ---- Phase Testing --------------------------------------------------------
const phaseSignOffSchema = Joi.object({
  testStatus: Joi.string().valid("Passed", "Failed").required().messages({
    "any.only": "Pick Passed or Failed",
    "any.required": "Pick Passed or Failed",
  }),
  testNotes: noteWhen("testStatus", ["Failed"], "Say what failed"),
});

// ---- Client approval ------------------------------------------------------
const phaseDecisionSchema = Joi.object({
  decision: Joi.string().valid("Approved", "Rejected", "Changes Requested").required().messages({
    "any.only": "Pick Approve, Reject or Request changes",
    "any.required": "Pick Approve, Reject or Request changes",
  }),
  note: noteWhen("decision", ["Rejected", "Changes Requested"], "Tell us what needs to change"),
});

// ---- Field Training -------------------------------------------------------
const trainingFields = {
  title: Joi.string().trim().min(3).max(150).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title is too short",
    "string.max": "Title is too long (max 150)",
    "any.required": "Title is required",
  }),
  scheduledAt: Joi.date().iso().required().messages({
    "date.base": "Pick a date and time",
    "date.format": "Pick a date and time",
    "any.required": "Pick a date and time",
  }),
  durationMinutes: Joi.number().integer().min(5).max(600).allow(null).messages({
    "number.base": "Duration must be in minutes",
    "number.min": "Duration must be at least 5 minutes",
    "number.max": "Duration can be at most 600 minutes",
  }),
  meetingLink: optionalLink("Meeting link"),
  notes: Joi.string().trim().max(2000).allow("", null).messages({
    "string.max": "Notes are too long (max 2000)",
  }),
};

const createTrainingSchema = Joi.object({ projectId, ...trainingFields });

const updateTrainingSchema = Joi.object({
  ...trainingFields,
  status: Joi.string().valid("Scheduled", "Completed", "Rescheduled", "Cancelled").messages({
    "any.only": "Pick a valid status",
  }),
});

module.exports = {
  createBuildSchema,
  buildResultSchema,
  phaseSignOffSchema,
  phaseDecisionSchema,
  createTrainingSchema,
  updateTrainingSchema,
};
