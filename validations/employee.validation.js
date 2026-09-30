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
    .pattern(/^[6-9]\d{9}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Phone number must be a valid 10-digit Indian mobile number.",
    }),

  phone2: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Phone number must be a valid 10-digit Indian mobile number.",
    }),

  whatsapp: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "WhatsApp number must be a valid 10-digit Indian mobile number.",
    }),

  joiningDate: Joi.date().iso().allow("", null),

  dateOfBirth: Joi.date().iso().allow("", null),

  linkedinUrl: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .allow("", null),

  githubUrl: Joi.string()
    .uri({
      scheme: ["http", "https"],
    })
    .allow("", null),

  aadhaarLast4: Joi.string()
    .pattern(/^\d{4}$/)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Aadhaar last 4 digits must contain exactly 4 digits.",
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
