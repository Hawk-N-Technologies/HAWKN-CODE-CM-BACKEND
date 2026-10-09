const Joi = require("joi");

const SERVER_STATUSES = ["Not Configured", "Configured"];
const CICD_STATUSES = ["Not Active", "Active"];
const CREDENTIAL_STATUSES = ["Not Added", "Added"];

// Optional http(s) link; empty → cleared
const optionalUrl = (label) =>
  Joi.string()
    .trim()
    .max(500)
    .uri({ scheme: ["http", "https"] })
    .allow("", null)
    .messages({
      "string.uri": `${label} must be a full http(s) link`,
      "string.uriCustomScheme": `${label} must start with http:// or https://`,
      "string.max": `${label} is too long`,
    });

// Optional bare domain like "staging.example.com" (no https://, no path)
const optionalDomain = (label) =>
  Joi.string()
    .trim()
    .lowercase()
    .max(255)
    .domain({ tlds: false })
    .allow("", null)
    .messages({
      "string.domain": `${label} must be a domain like staging.example.com (no https:// or /path)`,
      "string.max": `${label} is too long`,
    });

const deploymentSchema = Joi.object({
  repositoryUrl: optionalUrl("GitHub repository"),

  serverStatus: Joi.string()
    .valid(...SERVER_STATUSES)
    .default("Not Configured")
    .messages({ "any.only": `Server status must be one of: ${SERVER_STATUSES.join(", ")}` }),

  cicdStatus: Joi.string()
    .valid(...CICD_STATUSES)
    .default("Not Active")
    .messages({ "any.only": `CI/CD status must be one of: ${CICD_STATUSES.join(", ")}` }),

  credentialsStatus: Joi.string()
    .valid(...CREDENTIAL_STATUSES)
    .default("Not Added")
    .messages({ "any.only": `Credentials must be one of: ${CREDENTIAL_STATUSES.join(", ")}` }),

  devDomain: optionalDomain("Development domain"),
  stagingDomain: optionalDomain("Staging domain"),
  liveDomain: optionalDomain("Live domain"),

  documentationUrl: optionalUrl("Documentation link"),
})
  // Express 5 leaves req.body undefined when nothing is sent → reject that too
  .required()
  .messages({ "any.required": "Request body is required" })
  .prefs({ errors: { wrap: { label: false } } });

module.exports = {
  SERVER_STATUSES,
  CICD_STATUSES,
  CREDENTIAL_STATUSES,
  deploymentSchema,
};