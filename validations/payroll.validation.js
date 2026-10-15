const Joi = require("joi");

const PAYMENT_METHODS = ["Bank Transfer", "UPI", "Cheque", "Cash"];
const STATUSES = ["Pending", "Processed"];
const MAX_AMOUNT = 10000000; // ₹1 crore per field — blocks typos like an extra 0s

// Money: 0 or more, max 2 decimals (paise)
const money = () =>
  Joi.number().min(0).max(MAX_AMOUNT).precision(2).messages({
    "number.base": "{#label} must be a number",
    "number.min": "{#label} can't be negative",
    "number.max": "{#label} is too large",
  });

// Create payroll (POST body)
const createPayrollSchema = Joi.object({
  userUuid: Joi.string().guid().required().messages({
    "any.required": "Select an employee",
    "string.empty": "Select an employee",
    "string.guid": "Select an employee from the suggestions",
  }),

  // Month picker value, e.g. "2026-09"
  payPeriod: Joi.string()
    .pattern(/^(20\d{2})-(0[1-9]|1[0-2])$/)
    .required()
    .messages({
      "string.pattern.base": "Month must be in YYYY-MM format",
      "any.required": "Month is required",
      "string.empty": "Month is required",
    }),

  baseSalary: money().greater(0).required().label("Base salary").messages({
    "number.greater": "Base salary must be more than 0",
  }),

  lopDeduction: money()
    .default(0)
    .label("LOP deduction")
    // LOP can't be more than the base salary
    .max(Joi.ref("baseSalary"))
    .messages({ "number.max": "LOP deduction can't be more than the base salary" }),

  bonus: money().default(0).label("Bonus"),

  paymentMethod: Joi.string()
    .valid(...PAYMENT_METHODS)
    .default("Bank Transfer")
    .messages({ "any.only": `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}` }),
})
  // Express 5 leaves req.body undefined when nothing is sent — reject that too
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } }); // "Base salary can't…" not "\"Base salary\" can't…"

// Edit a Pending payroll (PUT body). Employee + month are NOT editable —
// changing those makes it a different payroll (delete + re-create instead).
const updatePayrollSchema = Joi.object({
  baseSalary: money().greater(0).required().label("Base salary").messages({
    "number.greater": "Base salary must be more than 0",
  }),

  lopDeduction: money()
    .default(0)
    .label("LOP deduction")
    .max(Joi.ref("baseSalary"))
    .messages({ "number.max": "LOP deduction can't be more than the base salary" }),

  bonus: money().default(0).label("Bonus"),

  paymentMethod: Joi.string()
    .valid(...PAYMENT_METHODS)
    .default("Bank Transfer")
    .messages({ "any.only": `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}` }),
})
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

// List / filter payroll (GET query string)
const listPayrollQuerySchema = Joi.object({
  startDate: Joi.date().iso().messages({ "date.format": "Start date must be YYYY-MM-DD" }),

  endDate: Joi.date()
    .iso()
    .when("startDate", {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref("startDate")),
    })
    .messages({
      "date.format": "End date must be YYYY-MM-DD",
      "date.min": "End date can't be before start date",
    }),

  userUuid: Joi.string().guid().messages({ "string.guid": "Invalid employee" }),

  status: Joi.string().valid(...STATUSES),
});

// Name autocomplete (GET query string)
const searchEmployeesQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required().messages({
    "string.min": "Type at least 2 characters",
    "any.required": "Search text is required",
    "string.empty": "Search text is required",
  }),
});

// Salary structure: set / update one employee's salary (PUT body)
const setSalarySchema = Joi.object({
  userUuid: Joi.string().guid().required().messages({
    "any.required": "Select an employee",
    "string.empty": "Select an employee",
    "string.guid": "Select an employee from the suggestions",
  }),

  salary: money().greater(0).required().label("Salary").messages({
    "number.greater": "Salary must be more than 0",
  }),
})
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

// Salary structure list (GET query string) — optional exact employee
const listSalariesQuerySchema = Joi.object({
  userUuid: Joi.string().guid().messages({ "string.guid": "Invalid employee" }),
});

module.exports = {
  PAYMENT_METHODS,
  createPayrollSchema,
  updatePayrollSchema,
  listPayrollQuerySchema,
  searchEmployeesQuerySchema,
  setSalarySchema,
  listSalariesQuerySchema,
  updatePayrollSchema
};

