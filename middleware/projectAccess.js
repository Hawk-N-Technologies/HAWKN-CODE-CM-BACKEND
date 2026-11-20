"use strict";

/**
 * Project-scoped access checks.
 *
 * Every check resolves the project behind the request INSIDE the logged-in
 * user's company (companyId always comes from the login token):
 *   - project in another company / unknown → 404 (never reveal it exists)
 *   - client role → must be the client of that project
 *   - requireLeadOfProject → must be the lead of THAT project
 *
 * The project can come from a route param, a body field, or a child record
 * (module / phase / task / testing) that carries projectId.
 */

const Project = require("../models/Project");
const Employee = require("../models/Employee");
const Client = require("../models/Client");
const ProjectOperation = require("../models/ProjectOperation");
const logger = require("../utils/logger");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);
const isPositiveInt = (value) =>
  /^\d+$/.test(String(value ?? "")) && Number(value) > 0;

// A project / module reference can be a UUID or a numeric id
function refWhere(ref) {
  if (isUuid(ref)) return { uuid: ref };
  if (isPositiveInt(ref)) return { id: Number(ref) };
  return null;
}

const PROJECT_ATTRIBUTES = [
  "id",
  "uuid",
  "name",
  "companyId",
  "clientId",
  "projectLeadId",
];

// Project of THIS company only
async function findCompanyProject(ref, companyId, transaction) {
  const where = refWhere(ref);

  if (!where || !companyId) return null;

  return Project.findOne({
    where: { ...where, companyId },
    attributes: PROJECT_ATTRIBUTES,
    transaction,
  });
}

async function findActiveEmployee(userId, companyId, transaction) {
  if (!userId || !companyId) return null;

  return Employee.findOne({
    where: { userId, companyId, employmentStatus: "Active" },
    attributes: ["id"],
    transaction,
  });
}

// Lead of THIS project (project lead, or lead on its operations plan)
async function isLeadOfProject(userId, companyId, project) {
  const employee = await findActiveEmployee(userId, companyId);

  if (!employee || !project) return false;

  if (Number(project.projectLeadId) === Number(employee.id)) return true;

  const operation = await ProjectOperation.findOne({
    where: {
      projectId: project.id,
      companyId,
      projectLeadId: employee.id,
    },
    attributes: ["id"],
  });

  return Boolean(operation);
}

// Client of THIS project
async function isClientOfProject(userId, companyId, project) {
  if (!project) return false;

  const client = await Client.findOne({
    where: { userId, companyId, isActive: true },
    attributes: ["id"],
  });

  return Boolean(client) && Number(client.id) === Number(project.clientId);
}

// ---------------------------------------------------------------------------
// Where the project comes from
// Each resolver returns { project } or { invalid: true } for a malformed id.
// ---------------------------------------------------------------------------

const projectFrom = {
  // /projects/:projectUuid/...  (UUID or numeric id)
  param: (name) => async (req) => {
    const ref = req.params[name];
    if (!refWhere(ref)) return { invalid: true };
    return { project: await findCompanyProject(ref, req.user.companyId) };
  },

  // body.projectId (UUID or numeric id)
  body: (field) => async (req) => {
    const ref = req.body?.[field];
    if (!refWhere(ref)) return { invalid: true };
    return { project: await findCompanyProject(ref, req.user.companyId) };
  },

  // /modules/:uuid, /phases/:uuid, /tasks/:uuid … — child record → its project
  child: (Model, param) => async (req) => {
    const uuid = req.params[param];
    if (!isUuid(uuid)) return { invalid: true };

    const child = await Model.findOne({
      where: { uuid },
      attributes: ["projectId"],
    });

    if (!child) return { project: null };

    return {
      project: await findCompanyProject(child.projectId, req.user.companyId),
    };
  },
};

function sendInvalid(res) {
  return res.status(400).json({ success: false, message: "Invalid ID." });
}

function sendNotFound(res) {
  return res.status(404).json({ success: false, message: "Not found." });
}

/**
 * Project must be in the user's company.
 * Clients must also be the client of that project.
 * Sets req.projectAccess = { project }.
 */
function requireProjectAccess(resolve) {
  return async (req, res, next) => {
    try {
      const { invalid, project } = await resolve(req);

      if (invalid) return sendInvalid(res);
      if (!project) return sendNotFound(res);

      if (req.user.role === "client") {
        const owns = await isClientOfProject(
          req.user.userId,
          req.user.companyId,
          project,
        );
        if (!owns) return sendNotFound(res);
      }

      req.projectAccess = { project };
      return next();
    } catch (error) {
      logger.error("Project access check failed", {
        userId: req.user?.userId,
        path: req.originalUrl,
        error: error.message,
      });
      return next(error);
    }
  };
}

/**
 * Must be the lead of THIS project (in the user's company).
 * allowAdmin: admins pass without being the lead.
 * Sets req.projectAccess = { project }.
 */
function requireLeadOfProject(resolve, { allowAdmin = false } = {}) {
  return async (req, res, next) => {
    try {
      const { invalid, project } = await resolve(req);

      if (invalid) return sendInvalid(res);
      if (!project) return sendNotFound(res);

      if (!(allowAdmin && req.user.role === "admin")) {
        const isLead = await isLeadOfProject(
          req.user.userId,
          req.user.companyId,
          project,
        );

        if (!isLead) {
          return res.status(403).json({
            success: false,
            message: "Only the lead of this project can do this.",
          });
        }
      }

      req.projectAccess = { project };
      return next();
    } catch (error) {
      logger.error("Project lead check failed", {
        userId: req.user?.userId,
        path: req.originalUrl,
        error: error.message,
      });
      return next(error);
    }
  };
}

module.exports = {
  projectFrom,
  requireProjectAccess,
  requireLeadOfProject,
  // shared helpers (used by services)
  isUuid,
  refWhere,
  findCompanyProject,
  findActiveEmployee,
  isLeadOfProject,
  isClientOfProject,
};