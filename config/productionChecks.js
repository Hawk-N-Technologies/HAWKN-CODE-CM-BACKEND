"use strict";

/**
 * Safety checks before the server starts in production (NODE_ENV=production).
 *
 *   errors   → the server refuses to start (unsafe or broken setup)
 *   warnings → the server starts, but something should be fixed
 *
 * Nothing here runs in development or tests.
 */

const EXAMPLE_JWT_SECRETS = new Set([
  "your-very-long-random-secret-key",
  "secret",
  "changeme",
  "change-me",
  "jwt_secret",
]);

// Demo accounts created by `npm run seed` — must never stay active on live
const DEMO_EMAILS = ["admin@gmail.com", "hr@gmail.com"];

function checkProductionConfig(env = process.env) {
  const errors = [];
  const warnings = [];

  const secret = String(env.JWT_SECRET || "");
  if (!secret) {
    errors.push("JWT_SECRET is not set.");
  } else if (EXAMPLE_JWT_SECRETS.has(secret.toLowerCase())) {
    errors.push("JWT_SECRET is still the example value from .env.example. Generate a new one.");
  } else if (secret.length < 32) {
    errors.push(`JWT_SECRET is too short (${secret.length} characters). Use at least 32 random characters.`);
  }

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is not set.");
  } else if (/\/\/[^@]*@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL)) {
    warnings.push("DATABASE_URL points at localhost. Make sure this is the live database.");
  }

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    warnings.push("VAPID keys are not set, so phone / laptop alerts are turned off.");
  }

  return { errors, warnings };
}

// After the database connects: warn loudly if demo accounts are still active
async function findActiveDemoAccounts(sequelize) {
  const [rows] = await sequelize.query(
    "SELECT email FROM users WHERE is_active = true AND lower(email) = ANY(:emails)",
    { replacements: { emails: DEMO_EMAILS } },
  );
  return rows.map((row) => row.email);
}

module.exports = { checkProductionConfig, findActiveDemoAccounts, DEMO_EMAILS };
