const Joi = require("joi");

const BONUS_TYPES = ["Performance", "Festival", "Referral", "Joining", "Other"];
const MAX_AMOUNT = 10000000; // ₹1 crore — blocks typos like extra 0s

const money = () =>
  Joi.number().greater(0).max(MAX_AMOUNT).precision(2).messages({
    "number.base": "{#label} must be a number",
    "number.greater": "{#label} must be more than 0",
    "number.max": "{#label} is too large",
  });

const userUuid = () =>
  Joi.string().guid().required().messages({
    "any.required": "Select an employee",
    "string.empty": "Select an employee",
    "string.guid": "Select an employee from the suggestions",
  });

const yyyyMm = () =>
  Joi.string()
    .pattern(/^(20\d{2})-(0[1-9]|1[0-2])$/)
    .required()
    .messages({
      "string.pattern.base": "Month must be in YYYY-MM format",
      "any.required": "Month is required",
      "string.empty": "Month is required",
    });

const reason = () =>
  Joi.string().trim().max(500).allow("", null).messages({ "string.max": "Reason is too long (max 500)" });

// ---------- Bonuses ----------

const createBonusSchema = Joi.object({
  userUuid: userUuid(),
  payPeriod: yyyyMm(),
  bonusType: Joi.string()
    .valid(...BONUS_TYPES)
    .required()
    .messages({ "any.only": `Bonus type must be one of: ${BONUS_TYPES.join(", ")}` }),
  amount: money().required().label("Amount"),
  reason: reason(),
})
  // Express 5 leaves req.body undefined when nothing is sent
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

// Edit the latest increment. Employee + previous salary are fixed.
const updateIncrementSchema = Joi.object({
  newSalary: money().required().label("New salary"),
  effectiveDate: Joi.date().iso().required().messages({
    "date.base": "Effective date must be a valid date",
    "date.format": "Effective date must be YYYY-MM-DD",
    "any.required": "Effective date is required",
  }),
  reason: reason(),
})
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

const listBonusesQuerySchema = Joi.object({
  userUuid: Joi.string().guid().messages({ "string.guid": "Invalid employee" }),
});

// Total for payroll auto-fill: ?userUuid=&payPeriod=2026-10
const bonusTotalQuerySchema = Joi.object({
  userUuid: userUuid(),
  payPeriod: yyyyMm(),
});

// ---------- Increments ----------

const createIncrementSchema = Joi.object({
  userUuid: userUuid(),
  newSalary: money().required().label("New salary"),
  effectiveDate: Joi.date().iso().required().messages({
    "date.base": "Effective date must be a valid date",
    "date.format": "Effective date must be YYYY-MM-DD",
    "any.required": "Effective date is required",
  }),
  reason: reason(),
})
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

const listIncrementsQuerySchema = Joi.object({
  userUuid: Joi.string().guid().messages({ "string.guid": "Invalid employee" }),
});

module.exports = {
  BONUS_TYPES,
  createBonusSchema,
  listBonusesQuerySchema,
  bonusTotalQuerySchema,
  createIncrementSchema,
  updateIncrementSchema,
  listIncrementsQuerySchema,
};