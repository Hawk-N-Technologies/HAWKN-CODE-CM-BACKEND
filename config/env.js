const path = require("path");
const dotenv = require("dotenv");

// Load .env from root directory if it exists
const result = dotenv.config({ path: path.resolve(__dirname, "../.env") });
const parsed = result.parsed || {};

// 1. Determine active NODE_ENV
const rawEnv =
  (process.env.NODE_ENV && process.env.NODE_ENV.trim()) ||
  (parsed.NODE_ENV && parsed.NODE_ENV.trim()) ||
  "production";

const normalized = rawEnv.toLowerCase();
const isStaging = normalized === "staging" || normalized === "stage";
const isProduction = normalized === "production" || normalized === "prod";
const isDevelopment = normalized === "development" || normalized === "dev";

const NODE_ENV = isStaging
  ? "staging"
  : isProduction
  ? "production"
  : normalized;

process.env.NODE_ENV = NODE_ENV;

// Helper to safely encode credentials in database URLs (e.g. passwords containing '#', '@', etc.)
function sanitizeDbUrl(url) {
  if (!url) return "";
  const trimmed = url.trim().replace(/^["']|["']$/g, "");
  const match = trimmed.match(
    /^(postgresql|postgres|mysql):\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)$/
  );
  if (!match) return trimmed;
  const [, proto, user, pass, host, port, db] = match;
  try {
    const safeUser = encodeURIComponent(decodeURIComponent(user));
    const safePass = encodeURIComponent(decodeURIComponent(pass));
    return `${proto}://${safeUser}:${safePass}@${host}${port ? ":" + port : ""}/${db}`;
  } catch {
    return trimmed;
  }
}

// 2. Resolve DATABASE_URL based on NODE_ENV
let rawDbUrl = (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) || "";

if (!rawDbUrl) {
  if (isStaging) {
    rawDbUrl = process.env.DATABASE_URL_STAGE || parsed.DATABASE_URL_STAGE || "";
  } else if (isProduction) {
    rawDbUrl = process.env.DATABASE_URL_PROD || parsed.DATABASE_URL_PROD || "";
  } else {
    rawDbUrl =
      process.env.DATABASE_URL_STAGE ||
      parsed.DATABASE_URL_STAGE ||
      process.env.DATABASE_URL_PROD ||
      parsed.DATABASE_URL_PROD ||
      "";
  }
}

const DATABASE_URL = sanitizeDbUrl(rawDbUrl);
process.env.DATABASE_URL = DATABASE_URL;

// 3. Resolve PORT based on NODE_ENV
let portValue = (process.env.PORT && process.env.PORT.trim()) || "";

if (!portValue) {
  if (isStaging) {
    portValue = process.env.PORT_STAGE || parsed.PORT_STAGE || "12121";
  } else if (isProduction) {
    portValue = process.env.PORT_PROD || parsed.PORT_PROD || "43211";
  } else {
    portValue =
      process.env.PORT_STAGE ||
      parsed.PORT_STAGE ||
      process.env.PORT_PROD ||
      parsed.PORT_PROD ||
      "3000";
  }
}

const PORT = parseInt(portValue, 10) || (isProduction ? 43211 : 12121);
process.env.PORT = String(PORT);

// 4. Resolve JWT_SECRET based on NODE_ENV
let rawJwtSecret =
  (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) || "";

if (!rawJwtSecret) {
  if (isStaging) {
    rawJwtSecret =
      process.env.JWT_SECRET_STAGE || parsed.JWT_SECRET_STAGE || "";
  } else if (isProduction) {
    rawJwtSecret = process.env.JWT_SECRET_PROD || parsed.JWT_SECRET_PROD || "";
  } else {
    rawJwtSecret =
      process.env.JWT_SECRET_STAGE ||
      parsed.JWT_SECRET_STAGE ||
      process.env.JWT_SECRET_PROD ||
      parsed.JWT_SECRET_PROD ||
      "";
  }
}

const JWT_SECRET = rawJwtSecret;
process.env.JWT_SECRET = JWT_SECRET;

// 5. Resolve JWT_EXPIRES_IN
const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || parsed.JWT_EXPIRES_IN || "30d";
process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;

module.exports = {
  NODE_ENV,
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  isProduction,
  isStaging,
  isDevelopment,
};

