"use strict";

/**
 * One-time setup for a CLEAN live database:  npm run setup:production
 *
 * Creates (only what's missing — safe to run twice):
 *   - the 7 roles the app needs
 *   - the company + its profile
 *   - the FIRST admin account (real email, strong password)
 *
 * Reads these from the environment (never from code):
 *   COMPANY_NAME               e.g. "Hawk'N Technologies"
 *   FIRST_ADMIN_EMAIL          a real company email
 *   FIRST_ADMIN_PASSWORD       12+ characters with upper, lower, number, symbol
 *   FIRST_ADMIN_FIRST_NAME     (optional, default "Admin")
 *   FIRST_ADMIN_LAST_NAME      (optional, default "")
 *
 * It never creates the demo accounts, and if the company already has an
 * admin it changes nothing. Everyone else (HR, developers, testers, BD,
 * clients) is then added from inside the app.
 */

const bcrypt = require("bcrypt");
const User = require("../models/User");
const Role = require("../models/Role");
const Company = require("../models/Company");
const CompanyProfile = require("../models/CompanyProfile");
const { DEMO_EMAILS } = require("../config/productionChecks");

const ROLES = [
  { name: "admin", description: "System administrator" },
  { name: "bde", description: "Business Development Executive" },
  { name: "client", description: "Client user" },
  { name: "developer", description: "Developer" },
  { name: "hr", description: "Human Resources" },
  { name: "project_lead", description: "Project lead" },
  { name: "tester", description: "Software tester" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readSettings(env) {
  const settings = {
    companyName: String(env.COMPANY_NAME || "").trim(),
    email: String(env.FIRST_ADMIN_EMAIL || "").trim().toLowerCase(),
    password: String(env.FIRST_ADMIN_PASSWORD || ""),
    firstName: String(env.FIRST_ADMIN_FIRST_NAME || "Admin").trim() || "Admin",
    lastName: String(env.FIRST_ADMIN_LAST_NAME || "").trim(),
  };

  const problems = [];
  if (!settings.companyName) problems.push("COMPANY_NAME is not set.");
  if (!EMAIL.test(settings.email)) problems.push("FIRST_ADMIN_EMAIL must be a valid email.");
  if (DEMO_EMAILS.includes(settings.email)) {
    problems.push(`${settings.email} is a demo account. Use a real company email.`);
  }

  const p = settings.password;
  if (p.length < 12 || p.length > 72 || !/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p) || !/[^A-Za-z0-9]/.test(p)) {
    problems.push(
      "FIRST_ADMIN_PASSWORD must be 12–72 characters with an uppercase letter, a lowercase letter, a number and a symbol.",
    );
  }

  return { settings, problems };
}

async function productionSetup(env = process.env) {
  const { settings, problems } = readSettings(env);

  if (problems.length) {
    const error = new Error(problems.join("\n"));
    error.isSetupProblem = true;
    throw error;
  }

  // 1) Roles
  const roleIds = {};
  for (const role of ROLES) {
    const [row] = await Role.findOrCreate({ where: { name: role.name }, defaults: role });
    roleIds[row.name] = row.id;
  }

  // 2) Company + profile
  const [company, companyCreated] = await Company.findOrCreate({
    where: { name: settings.companyName },
    defaults: { name: settings.companyName },
  });

  await CompanyProfile.findOrCreate({
    where: { companyId: company.id },
    defaults: {
      companyId: company.id,
      officialCompanyName: company.name,
      officialEmail: settings.email,
      vision: "",
      mission: "",
      blogContent: "",
    },
  });

  // 3) First admin — only if this company has no admin yet
  const existingAdmin = await User.findOne({
    where: { companyId: company.id, roleId: roleIds.admin },
    attributes: ["email"],
  });

  if (existingAdmin) {
    return { companyCreated, adminCreated: false, adminEmail: existingAdmin.email, companyName: company.name };
  }

  const emailTaken = await User.findOne({ where: { email: settings.email }, attributes: ["id"] });
  if (emailTaken) {
    const error = new Error(`${settings.email} is already used by another account.`);
    error.isSetupProblem = true;
    throw error;
  }

  await User.create({
    companyId: company.id,
    roleId: roleIds.admin,
    firstName: settings.firstName,
    lastName: settings.lastName || null,
    email: settings.email,
    passwordHash: await bcrypt.hash(settings.password, 12),
    isActive: true,
  });

  return { companyCreated, adminCreated: true, adminEmail: settings.email, companyName: company.name };
}

module.exports = productionSetup;
module.exports.readSettings = readSettings;
