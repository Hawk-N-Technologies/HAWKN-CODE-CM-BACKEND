"use strict";

/**
 * Testing module
 *
 *  Build Testing   tester adds a build (version) of a project and records
 *                  Passed / Failed → the project lead is told
 *  Phase Testing   tester signs off each phase Passed / Failed
 *                  → Passed + "Needs client approval" (ticked by the lead)
 *                    sends the phase to the client
 *  Client approval client Approves / Rejects / Requests changes on those
 *                  phases → lead and testers are told
 *  Field Training  tester schedules training sessions (date, Meet link,
 *                  notes) → the client sees them and is told
 *
 * Every read and write is limited to the projects the user works on:
 * testers → projects they test, clients → their own projects, admins → company.
 */

const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");
const events = require("./eventNotifications");
const { getTesterProjectIds } = require("./bugsService");
const { findActiveEmployee } = require("../middleware/projectAccess");
const {
  Project,
  Client,
  User,
  ProjectModule,
  ProjectPhase,
  ProjectBuild,
  FieldTraining,
} = require("../models/associations");

const MAX_ROWS = 500;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || null;

const clean = (value) => (typeof value === "string" ? value.trim() || null : value ?? null);

// ---------------------------------------------------------------------------
// Which projects can this user see?
//   null  → every project of the company (admin)
//   []    → none
// ---------------------------------------------------------------------------

async function testerProjectIds(user) {
  const employee = await findActiveEmployee(user.userId, user.companyId);
  if (!employee) return [];
  return (await getTesterProjectIds(employee.id, user.companyId)).map(Number);
}

async function clientProjectIds(user) {
  const client = await Client.findOne({
    where: { userId: user.userId, companyId: user.companyId, isActive: true },
    attributes: ["id"],
  });
  if (!client) return [];

  const projects = await Project.findAll({
    where: { companyId: user.companyId, clientId: client.id },
    attributes: ["id"],
    raw: true,
  });
  return projects.map((project) => Number(project.id));
}

async function visibleProjectIds(user) {
  if (user.role === "admin") return null;
  if (user.role === "tester") return testerProjectIds(user);
  if (user.role === "client") return clientProjectIds(user);
  return [];
}

const projectFilter = (ids) => (ids === null ? {} : { projectId: { [Op.in]: ids.length ? ids : [0] } });

// The tester must test this project (404 otherwise, so nothing leaks)
async function assertTesterOf(user, projectId) {
  const ids = await testerProjectIds(user);
  if (!ids.includes(Number(projectId))) throw httpError(404, "Not found.");
}

async function testerProjectByUuid(user, uuid) {
  const project = await Project.findOne({
    where: { uuid, companyId: user.companyId },
    attributes: ["id", "uuid", "name", "status"],
  });
  if (!project) throw httpError(404, "Project not found.");

  const ids = await testerProjectIds(user);
  if (!ids.includes(Number(project.id))) throw httpError(404, "Project not found.");
  if (project.status === "Cancelled") throw httpError(409, "This project is cancelled.");

  return project;
}

// Tester's projects (for the Add build / Schedule training forms)
async function listTesterProjects(user) {
  const ids = await testerProjectIds(user);
  if (!ids.length) return [];

  const projects = await Project.findAll({
    where: { id: { [Op.in]: ids }, companyId: user.companyId, status: { [Op.ne]: "Cancelled" } },
    attributes: ["uuid", "name", "status"],
    order: [["name", "ASC"]],
  });
  return projects.map((project) => project.get({ plain: true }));
}

const projectInclude = { model: Project, as: "project", attributes: ["uuid", "name"] };

// ===========================================================================
// Build Testing
// ===========================================================================

function buildResponse(build) {
  return {
    uuid: build.uuid,
    project: { uuid: build.project?.uuid ?? null, name: build.project?.name ?? "—" },
    versionLabel: build.versionLabel,
    environment: build.environment,
    buildUrl: build.buildUrl,
    releaseNotes: build.releaseNotes,
    result: build.result,
    testNotes: build.testNotes,
    testedBy: fullName(build.tester),
    testedAt: build.testedAt,
    createdAt: build.createdAt,
  };
}

const buildInclude = [projectInclude, { model: User, as: "tester", attributes: ["firstName", "lastName", "email"] }];

async function listBuilds(user) {
  const ids = await visibleProjectIds(user);
  const rows = await ProjectBuild.findAll({
    where: { companyId: user.companyId, ...projectFilter(ids) },
    include: buildInclude,
    order: [["createdAt", "DESC"]],
    limit: MAX_ROWS,
  });
  return rows.map(buildResponse);
}

async function reloadBuild(id) {
  return buildResponse(await ProjectBuild.findOne({ where: { id }, include: buildInclude }));
}

async function createBuild(user, body) {
  const project = await testerProjectByUuid(user, body.projectId);

  const build = await ProjectBuild.create({
    companyId: user.companyId,
    projectId: project.id,
    versionLabel: body.versionLabel.trim(),
    environment: body.environment,
    buildUrl: clean(body.buildUrl),
    releaseNotes: clean(body.releaseNotes),
    result: "Pending",
    createdBy: user.userId,
  });

  return reloadBuild(build.id);
}

async function recordBuildResult(user, uuid, body) {
  const build = await ProjectBuild.findOne({ where: { uuid, companyId: user.companyId } });
  if (!build) throw httpError(404, "Build not found.");
  await assertTesterOf(user, build.projectId);

  await build.update({
    result: body.result,
    testNotes: clean(body.testNotes),
    testedBy: user.userId,
    testedAt: new Date(),
  });

  await events.buildTested(build);
  return reloadBuild(build.id);
}

// ===========================================================================
// Phase Testing (tester sign-off)
// ===========================================================================

const phaseInclude = [
  projectInclude,
  { model: ProjectModule, as: "module", attributes: ["name"] },
  { model: User, as: "phaseTester", attributes: ["firstName", "lastName", "email"] },
];

function phaseResponse(phase, role) {
  const base = {
    uuid: phase.uuid,
    name: phase.name,
    description: phase.description,
    project: { uuid: phase.project?.uuid ?? null, name: phase.project?.name ?? "—" },
    moduleName: phase.module?.name ?? "—",
    clientApprovalStatus: phase.clientApprovalStatus,
    clientNote: phase.clientNote,
    clientRespondedAt: phase.clientRespondedAt,
    testedAt: phase.testedAt,
  };

  if (role === "client") return base;

  return {
    ...base,
    status: phase.status,
    startDate: phase.startDate,
    endDate: phase.endDate,
    needsClientApproval: phase.needsClientApproval,
    testStatus: phase.testStatus,
    testNotes: phase.testNotes,
    testedBy: fullName(phase.phaseTester),
  };
}

async function listPhases(user) {
  const ids = await visibleProjectIds(user);
  const rows = await ProjectPhase.findAll({
    where: projectFilter(ids),
    include: [
      { ...projectInclude, where: { companyId: user.companyId }, required: true },
      ...phaseInclude.slice(1),
    ],
    order: [["projectId", "ASC"], ["sortOrder", "ASC"], ["id", "ASC"]],
    limit: MAX_ROWS * 4,
  });
  return rows.map((row) => phaseResponse(row, user.role));
}

async function findCompanyPhase(user, uuid, options = {}) {
  const phase = await ProjectPhase.findOne({
    where: { uuid },
    include: [{ model: Project, as: "project", attributes: ["companyId"], where: { companyId: user.companyId }, required: true }],
    ...options,
  });
  if (!phase) throw httpError(404, "Phase not found.");
  return phase;
}

async function reloadPhase(id, role) {
  return phaseResponse(await ProjectPhase.findOne({ where: { id }, include: phaseInclude }), role);
}

async function signOffPhase(user, uuid, body) {
  const before = await findCompanyPhase(user, uuid);
  await assertTesterOf(user, before.projectId);

  const passed = body.testStatus === "Passed";
  const sendToClient = passed && before.needsClientApproval;

  const saved = await sequelize.transaction(async (transaction) => {
    const phase = await ProjectPhase.findOne({ where: { id: before.id }, transaction, lock: true });

    await phase.update(
      {
        testStatus: body.testStatus,
        testNotes: clean(body.testNotes),
        testedBy: user.userId,
        testedAt: new Date(),
        // Passed + needs approval → (back) to the client. Failed → pulled back.
        ...(sendToClient
          ? { clientApprovalStatus: "Pending", clientNote: null, clientRespondedAt: null }
          : !passed && phase.clientApprovalStatus === "Pending"
            ? { clientApprovalStatus: null }
            : {}),
      },
      { transaction },
    );

    return phase;
  });

  await events.phaseTested(saved, user.companyId);
  if (sendToClient) await events.phaseNeedsClientApproval(saved, user.companyId);

  return reloadPhase(saved.id, user.role);
}

// ===========================================================================
// Client approval (phases the lead ticked "Needs client approval")
// ===========================================================================

async function listClientPhases(user) {
  const ids = await clientProjectIds(user);
  if (!ids.length) return [];

  const rows = await ProjectPhase.findAll({
    where: {
      projectId: { [Op.in]: ids },
      needsClientApproval: true,
      clientApprovalStatus: { [Op.ne]: null },
    },
    include: phaseInclude.slice(0, 2),
    order: [["updatedAt", "DESC"]],
    limit: MAX_ROWS,
  });
  return rows.map((row) => phaseResponse(row, "client"));
}

async function decidePhase(user, uuid, body) {
  const ids = await clientProjectIds(user);

  const saved = await sequelize.transaction(async (transaction) => {
    const phase = await ProjectPhase.findOne({
      where: { uuid, projectId: { [Op.in]: ids.length ? ids : [0] }, needsClientApproval: true },
      transaction,
      lock: true,
    });

    if (!phase || !phase.clientApprovalStatus) throw httpError(404, "Phase not found.");
    if (phase.clientApprovalStatus !== "Pending") {
      throw httpError(409, "You've already answered this phase.");
    }

    await phase.update(
      {
        clientApprovalStatus: body.decision,
        clientNote: clean(body.note),
        clientRespondedAt: new Date(),
      },
      { transaction },
    );

    return phase;
  });

  await events.phaseClientDecision(saved, user.companyId);
  return reloadPhase(saved.id, "client");
}

// ===========================================================================
// Field Training
// ===========================================================================

const trainingInclude = [projectInclude, { model: User, as: "trainer", attributes: ["firstName", "lastName", "email"] }];

function trainingResponse(training) {
  return {
    uuid: training.uuid,
    project: { uuid: training.project?.uuid ?? null, name: training.project?.name ?? "—" },
    title: training.title,
    scheduledAt: training.scheduledAt,
    durationMinutes: training.durationMinutes,
    meetingLink: training.meetingLink,
    notes: training.notes,
    status: training.status,
    trainer: fullName(training.trainer),
  };
}

async function listTrainings(user) {
  const ids = await visibleProjectIds(user);
  const rows = await FieldTraining.findAll({
    where: { companyId: user.companyId, ...projectFilter(ids) },
    include: trainingInclude,
    order: [["scheduledAt", "DESC"]],
    limit: MAX_ROWS,
  });
  return rows.map(trainingResponse);
}

async function reloadTraining(id) {
  return trainingResponse(await FieldTraining.findOne({ where: { id }, include: trainingInclude }));
}

const trainingFields = (body) => ({
  title: body.title.trim(),
  scheduledAt: new Date(body.scheduledAt),
  durationMinutes: body.durationMinutes ?? null,
  meetingLink: clean(body.meetingLink),
  notes: clean(body.notes),
});

async function createTraining(user, body) {
  const project = await testerProjectByUuid(user, body.projectId);

  const training = await FieldTraining.create({
    ...trainingFields(body),
    companyId: user.companyId,
    projectId: project.id,
    status: "Scheduled",
    createdBy: user.userId,
  });

  await events.trainingScheduled(training, "scheduled");
  return reloadTraining(training.id);
}

async function updateTraining(user, uuid, body) {
  const training = await FieldTraining.findOne({ where: { uuid, companyId: user.companyId } });
  if (!training) throw httpError(404, "Training not found.");
  await assertTesterOf(user, training.projectId);

  const next = trainingFields(body);
  const previousStatus = training.status;
  const moved = new Date(training.scheduledAt).getTime() !== next.scheduledAt.getTime();
  const status = body.status ?? previousStatus;

  await training.update({ ...next, status: moved && status === "Scheduled" ? "Rescheduled" : status });

  // Tell the client when the date moves or the session is cancelled
  if (moved || (status === "Cancelled" && previousStatus !== "Cancelled")) {
    await events.trainingScheduled(training, status === "Cancelled" ? "cancelled" : "rescheduled");
  }

  return reloadTraining(training.id);
}

module.exports = {
  listTesterProjects,
  listBuilds,
  createBuild,
  recordBuildResult,
  listPhases,
  signOffPhase,
  listClientPhases,
  decidePhase,
  listTrainings,
  createTraining,
  updateTraining,
};
