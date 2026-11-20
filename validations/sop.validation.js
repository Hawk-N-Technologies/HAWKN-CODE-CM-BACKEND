const Joi = require("joi");

const DEPARTMENTS = ["General", "HR", "Development", "Testing", "Sales & BD", "Operations", "Finance"];

// Rich text HTML from the editor (cleaned with DOMPurify when shown)
const MAX_CONTENT = 200000;

const sopSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    "string.empty": "Title is required",
    "string.min": "Title is too short",
    "string.max": "Title is too long (max 200)",
    "any.required": "Title is required",
  }),
  department: Joi.string().valid(...DEPARTMENTS).default("General").messages({
    "any.only": "Pick a valid department",
  }),
  effectiveDate: Joi.date().iso().allow(null, "").messages({
    "date.base": "Effective date must be a valid date",
    "date.format": "Effective date must be a valid date",
  }),
  content: Joi.string().max(MAX_CONTENT).required().messages({
    "string.empty": "Write the procedure",
    "string.max": "The procedure is too long",
    "any.required": "Write the procedure",
  }),
});

module.exports = { sopSchema, SOP_DEPARTMENTS: DEPARTMENTS };
