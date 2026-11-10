const Joi = require("joi");

// Must match the Sequelize model and projects table CHECK constraints.
const TIERS = ["Tier I", "Tier II", "Tier III"];

const STATUSES = [
  "Planning",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Brd Approval",
  "In Development",
  "Testing",
  "Completed",
  "On Hold",
  "Cancelled",
];

const PROJECT_TYPES = [
  "Web Application",
  "Mobile Application",
  "Website",
  "Backend / API",
  "AI / ML",
  "Desktop Application",
  "E-commerce",
  "Other",
];

const optionalDate = (label) =>
  Joi.date()
    .iso()
    .allow(null, "")
    .messages({
      "date.base": `${label} must be a valid date`,
      "date.format": `${label} must be YYYY-MM-DD`,
    });

// Allows:
// https://github.com/username
// https://github.com/username/repository
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[^/\s]+(?:\/[^/\s]+)?\/?$/;

// GitHub links: maximum 4, one URL per line.
const githubReposSchema = Joi.string()
  .trim()
  .allow("", null)
  .custom((value, helpers) => {
    if (!value) return value;

    const urls = value
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (urls.length > 4) {
      return helpers.error("github.maxLinks");
    }

    const invalidUrl = urls.find((url) => !GITHUB_URL_REGEX.test(url));

    if (invalidUrl) {
      return helpers.error("github.invalidUrl", { invalidUrl });
    }

    return urls.join("\n");
  })
  .messages({
    "github.maxLinks": "Maximum 4 GitHub links allowed",
    "github.invalidUrl": "Invalid GitHub URL",
  });

// Create + edit use the same body.
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

  // Optional — a project can start without a lead.
  projectLeadUuid: Joi.string().guid().allow(null, "").messages({
    "string.guid": "Select a project lead from the list",
  }),

  tier: Joi.string()
    .valid(...TIERS)
    .default("Tier I")
    .messages({
      "any.only": `Tier must be one of: ${TIERS.join(", ")}`,
    }),

  projectType: Joi.string()
    .valid(...PROJECT_TYPES)
    .required()
    .messages({
      "any.only": `Project type must be one of: ${PROJECT_TYPES.join(", ")}`,
      "any.required": "Select a project type",
      "string.empty": "Select a project type",
    }),

  startDate: optionalDate("Start date"),

  deadline: optionalDate("Deadline"),

  internalDeadline: optionalDate("Internal deadline"),

  status: Joi.string()
    .valid(...STATUSES)
    .default("Planning")
    .messages({
      "any.only": `Status must be one of: ${STATUSES.join(", ")}`,
    }),

  progress: Joi.number().integer().min(0).max(100).default(0).messages({
    "number.base": "Progress must be a number",
    "number.integer": "Progress must be a whole number",
    "number.min": "Progress can't be below 0%",
    "number.max": "Progress can't be above 100%",
  }),

  description: Joi.string().trim().max(5000).allow("", null).messages({
    "string.max": "Description is too long (max 5000)",
  }),

  githubRepos: githubReposSchema,

  serverUrl: Joi.string()
    .trim()
    .uri({
      scheme: ["http", "https"],
    })
    .allow("", null)
    .messages({
      "string.uri": "Enter a valid server URL",
    }),
})
  .required()
  .messages({
    "any.required": "Request body is required",
  })
  .prefs({
    errors: {
      wrap: {
        label: false,
      },
    },
  });

const listProjectsQuerySchema = Joi.object({
  status: Joi.string()
    .valid(...STATUSES)
    .messages({
      "any.only": `Status must be one of: ${STATUSES.join(", ")}`,
    }),
});

module.exports = {
  TIERS,
  STATUSES,
  PROJECT_TYPES,
  projectSchema,
  listProjectsQuerySchema,
};
