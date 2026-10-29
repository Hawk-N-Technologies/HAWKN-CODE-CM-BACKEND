const Joi = require("joi");

const createEmployeeSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required(),

  lastName: Joi.string().trim().min(2).max(50).required(),

  email: Joi.string().trim().lowercase().email().max(255).required(),

  password: Joi.string().min(8).max(128).required(),

  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "any.only": "Password and confirm password do not match.",
  }),

  roleUuid: Joi.string()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .required(),

  phone1: Joi.string()
    .pattern(/^\d{4,15}$/)
    .required()
    .messages({
      "any.required": "Phone number is required.",
      "string.empty": "Phone number is required.",
      "string.pattern.base":
        "Phone number must contain 4 to 15 digits.",
    }),

  phone2: Joi.string()
    .pattern(/^\d{4,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Phone number must contain 4 to 15 digits.",
    }),

  whatsapp: Joi.string()
    .pattern(/^\d{4,15}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "WhatsApp number must contain 4 to 15 digits.",
    }),

  address: Joi.string().trim().max(500).allow("", null),

  city: Joi.string().trim().max(100).allow("", null),

  country: Joi.string().trim().max(100).allow("", null),

  phone1CountryCode: Joi.string()
    .pattern(/^\+[1-9]\d{0,2}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Phone 1 country code must be a valid international dialing code.",
    }),

  phone2CountryCode: Joi.string()
    .pattern(/^\+[1-9]\d{0,2}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Phone 2 country code must be a valid international dialing code.",
    }),

  whatsappCountryCode: Joi.string()
    .pattern(/^\+[1-9]\d{0,2}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "WhatsApp country code must be a valid international dialing code.",
    }),

  joiningDate: Joi.date().iso().allow("", null),

  dateOfBirth: Joi.date().iso().required().messages({
    "any.required": "Date of birth is required.",
    "date.base": "Date of birth must be a valid ISO date.",
    "date.format": "Date of birth must be a valid ISO date.",
  }),

  linkedinUrl: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .required()
    .messages({
      "any.required": "LinkedIn URL is required.",
      "string.empty": "LinkedIn URL is required.",
    }),

  githubUrl: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .required()
    .messages({
      "any.required": "GitHub URL is required.",
      "string.empty": "GitHub URL is required.",
    }),

  aadhaarLast4: Joi.string()
    .pattern(/^\d{4}$/)
    .required()
    .messages({
      "any.required": "Aadhaar last 4 digits are required.",
      "string.empty": "Aadhaar last 4 digits are required.",
      "string.pattern.base":
        "Aadhaar last 12 digits must contain exactly 4 digits.",
    }),

  employmentType: Joi.string()
    .valid("Full Time", "Intern", "Probation")
    .default("Full Time"),

  employmentStatus: Joi.string()
    .valid("Active", "On Leave", "Exited")
    .default("Active"),

  photoUrl: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .allow("", null),
});

module.exports = {
  createEmployeeSchema,
};
