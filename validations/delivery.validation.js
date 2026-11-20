const Joi = require("joi");

const MAX_DELIVERABLES = 30;
const MAX_DOCS = 10;

// http(s) links only — no javascript:, file:, etc.
const link = (label) =>
  Joi.string()
    .trim()
    .max(500)
    .uri({ scheme: ["http", "https"] })
    .messages({
      "string.empty": `${label} is required`,
      "string.uri": `${label} must be a full http(s) link`,
      "string.uriCustomScheme": `${label} must be a full http(s) link`,
      "string.max": `${label} is too long (max 500)`,
      "any.required": `${label} is required`,
    });

const deliveryFields = {
  versionLabel: Joi.string()
    .trim()
    .max(50)
    .allow("", null)
    .messages({ "string.max": "Version is too long (max 50)" }),

  liveUrl: link("Live link").required(),

  deliverables: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(200)
        .messages({
          "string.empty": "A deliverable can't be empty",
          "string.max": "A deliverable is too long (max 200)",
        }),
    )
    .min(1)
    .max(MAX_DELIVERABLES)
    .required()
    .messages({
      "array.min": "Add at least one deliverable",
      "array.max": `Up to ${MAX_DELIVERABLES} deliverables`,
      "any.required": "Add at least one deliverable",
    }),

  docs: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().trim().min(1).max(150).required().messages({
          "string.empty": "Document title is required",
          "any.required": "Document title is required",
          "string.max": "Document title is too long (max 150)",
        }),
        url: link("Document link").required(),
      }),
    )
    .max(MAX_DOCS)
    .default([])
    .messages({ "array.max": `Up to ${MAX_DOCS} documents` }),

  notes: Joi.string()
    .trim()
    .max(2000)
    .allow("", null)
    .messages({ "string.max": "Notes are too long (max 2000)" }),
};

// Tester: new delivery for a project
const createDeliverySchema = Joi.object({
  projectId: Joi.string().guid().required().messages({
    "string.guid": "Pick a project",
    "string.empty": "Pick a project",
    "any.required": "Pick a project",
  }),
  ...deliveryFields,
});

// Tester: fix a delivery that Admin sent back (same fields, project fixed)
const updateDeliverySchema = Joi.object(deliveryFields);

// Admin: send back to the tester — a note is required
const sendBackSchema = Joi.object({
  note: Joi.string().trim().min(3).max(2000).required().messages({
    "string.empty": "Tell the tester what to fix",
    "string.min": "Tell the tester what to fix",
    "string.max": "Note is too long (max 2000)",
    "any.required": "Tell the tester what to fix",
  }),
});

// Client: follow-up → a "Change Request" ticket
const followUpSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title is too short",
    "string.max": "Title is too long (max 200)",
    "any.required": "Title is required",
  }),
  description: Joi.string()
    .trim()
    .max(5000)
    .allow("", null)
    .messages({ "string.max": "Description is too long (max 5000)" }),
  severity: Joi.string()
    .valid("Low", "Medium", "High", "Critical")
    .default("Medium")
    .messages({ "any.only": "Pick a valid priority" }),
});

module.exports = {
  createDeliverySchema,
  updateDeliverySchema,
  sendBackSchema,
  followUpSchema,
};
