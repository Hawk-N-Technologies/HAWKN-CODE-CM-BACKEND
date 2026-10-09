const sequelize = require("../config/db");
const { Project, Client, User } = require("../models/associations");
const ProjectDeployment = require("../models/projectDeployment");
const logger = require("../utils/logger");

/**
 * Admin → Deployment Planning. One deployment plan per project.
 * Sequelize models only — no raw SQL, no changes to associations.js
 * (projects + plans are loaded in two queries and merged here).
 */

const MAX_ROWS = 500; // safety cap

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ");
const emptyToNull = (value) => (value === undefined || value === null || value === "" ? null : value);

// What a plan looks like before anything is saved
const DEFAULT_PLAN = {
  uuid: null,
  repositoryUrl: null,
  serverStatus: "Not Configured",
  cicdStatus: "Not Active",
  credentialsStatus: "Not Added",
  devDomain: null,
  stagingDomain: null,
  liveDomain: null,
  documentationUrl: null,
  updatedAt: null,
};

function planToResponse(plan) {
  if (!plan) return { ...DEFAULT_PLAN };
  return {
    uuid: plan.uuid,
    repositoryUrl: plan.repositoryUrl,
    serverStatus: plan.serverStatus,
    cicdStatus: plan.cicdStatus,
    credentialsStatus: plan.credentialsStatus,
    devDomain: plan.devDomain,
    stagingDomain: plan.stagingDomain,
    liveDomain: plan.liveDomain,
    documentationUrl: plan.documentationUrl,
    updatedAt: plan.updatedAt,
  };
}

// Ready / not-ready checklist used by the page badges + table
function readiness(plan) {
  const checks = {
    github: Boolean(plan.repositoryUrl),
    server: plan.serverStatus === "Configured",
    cicd: plan.cicdStatus === "Active",
    credentials: plan.credentialsStatus === "Added",
    liveDomain: Boolean(plan.liveDomain),
  };
  const done = Object.values(checks).filter(Boolean).length;
  return { checks, done, total: Object.keys(checks).length, isReady: done === Object.keys(checks).length };
}

function projectToResponse(project) {
  return {
    uuid: project.uuid,
    name: project.name,
    status: project.status,
    clientName: fullName(project.client?.user) || "—",
  };
}

// Project of THIS company, or 404 (same answer whether missing or other company's)
async function findProject(projectUuid, companyId, transaction) {
  const project = await Project.findOne({
    where: { uuid: projectUuid, companyId },
    attributes: ["id", "uuid", "name", "status"],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id"],
        include: [{ model: User, as: "user", attributes: ["firstName", "lastName"] }],
      },
    ],
    transaction,
  });
  if (!project) throw httpError(404, "Project not found");
  return project;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Every project + its deployment status (for the overview table / picker)
async function listProjects(companyId) {
  try {
    const projects = await Project.findAll({
      where: { companyId },
      attributes: ["id", "uuid", "name", "status"],
      include: [
        {
          model: Client,
          as: "client",
          attributes: ["id"],
          include: [{ model: User, as: "user", attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [["name", "ASC"]],
      limit: MAX_ROWS,
    });

    const plans = projects.length
      ? await ProjectDeployment.findAll({
          where: { companyId, projectId: projects.map((p) => p.id) },
        })
      : [];
    const planByProjectId = new Map(plans.map((plan) => [plan.projectId, plan]));

    const rows = projects.map((project) => {
      const plan = planToResponse(planByProjectId.get(project.id));
      return {
        project: projectToResponse(project),
        hasPlan: Boolean(plan.uuid),
        plan,
        readiness: readiness(plan),
      };
    });

    logger.info("Deployment plans fetched", { companyId, count: rows.length });
    return rows;
  } catch (error) {
    logger.error("Failed to fetch deployment plans", { companyId, error: error.message, stack: error.stack });
    throw error;
  }
}

async function getPlan(projectUuid, companyId) {
  const project = await findProject(projectUuid, companyId);
  const plan = planToResponse(
    await ProjectDeployment.findOne({ where: { projectId: project.id, companyId } }),
  );
  return { project: projectToResponse(project), hasPlan: Boolean(plan.uuid), plan, readiness: readiness(plan) };
}

/**
 * Save = create the plan the first time, update it after.
 * Transaction + row lock so two admins saving at once can't create two plans.
 */
async function savePlan(projectUuid, companyId, userId, data) {
  try {
    const created = await sequelize.transaction(async (transaction) => {
      const project = await findProject(projectUuid, companyId, transaction);

      const values = {
        repositoryUrl: emptyToNull(data.repositoryUrl),
        serverStatus: data.serverStatus,
        cicdStatus: data.cicdStatus,
        credentialsStatus: data.credentialsStatus,
        devDomain: emptyToNull(data.devDomain),
        stagingDomain: emptyToNull(data.stagingDomain),
        liveDomain: emptyToNull(data.liveDomain),
        documentationUrl: emptyToNull(data.documentationUrl),
        updatedBy: userId,
      };

      const existing = await ProjectDeployment.findOne({
        where: { projectId: project.id, companyId },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (existing) {
        await existing.update(values, { transaction });
        return false;
      }

      await ProjectDeployment.create({ companyId, projectId: project.id, ...values }, { transaction });
      return true;
    });

    logger.info(created ? "Deployment plan created" : "Deployment plan updated", { companyId, projectUuid, userId });
    return { created, ...(await getPlan(projectUuid, companyId)) };
  } catch (error) {
    logger.error("Failed to save deployment plan", { companyId, projectUuid, error: error.message });
    throw error;
  }
}

module.exports = {
  listProjects,
  getPlan,
  savePlan,
};