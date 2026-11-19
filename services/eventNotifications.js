"use strict";

/**
 * Who gets notified, and when (agreed plan):
 *  - Developer     : given a task (existing) or a bug
 *  - Project Lead  : given a project; a tester reports a bug; a bug comes back
 *  - Tester        : a bug is sent for retest
 *  - Team members  : added to a project's team
 *  - Client        : a BRD needs their approval
 *  - Admin         : a phase is completed
 *
 * Each in-app notification also pops up on phones/laptops (pushService).
 * Every function here is called AFTER the change is saved, and never
 * throws: a failed notification must not undo or block the real action.
 */

const { Op } = require("@sequelize/core");
const notificationService = require("./notificationService");
const Employee = require("../models/Employee");
const Client = require("../models/Client");
const Project = require("../models/Project");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectOperationTester = require("../models/ProjectOperationTester");
const logger = require("../utils/logger");

async function safely(event, fn) {
  try {
    await fn();
  } catch (error) {
    logger.error("Event notification failed", { event, error: error?.message });
  }
}

// employees.id → users.id (same company only)
async function userIdsOfEmployees(employeeIds, companyId) {
  const ids = [...new Set((employeeIds || []).map(Number))].filter((id) => id > 0);
  if (!ids.length) return [];

  const employees = await Employee.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["userId"],
    raw: true,
  });

  return employees.map((employee) => employee.userId).filter(Boolean);
}

// The lead(s) of a project: projects.project_lead_id + operations plan lead
async function leadUserIds(projectId, companyId) {
  const [project, operations] = await Promise.all([
    Project.findOne({ where: { id: projectId, companyId }, attributes: ["projectLeadId"], raw: true }),
    ProjectOperation.findAll({ where: { projectId, companyId }, attributes: ["projectLeadId"], raw: true }),
  ]);

  return userIdsOfEmployees(
    [project?.projectLeadId, ...operations.map((op) => op.projectLeadId)],
    companyId,
  );
}

// Testers assigned to a project
async function testerUserIds(projectId, companyId) {
  const operations = await ProjectOperation.findAll({
    where: { projectId, companyId },
    attributes: ["id", "testerId"],
    raw: true,
  });
  if (!operations.length) return [];

  const links = await ProjectOperationTester.findAll({
    where: { projectOperationId: { [Op.in]: operations.map((op) => op.id) } },
    attributes: ["employeeId"],
    raw: true,
  });

  return userIdsOfEmployees(
    [...operations.map((op) => op.testerId), ...links.map((link) => link.employeeId)],
    companyId,
  );
}

async function projectInfo(projectId, companyId) {
  return Project.findOne({
    where: { id: projectId, companyId },
    attributes: ["id", "uuid", "name"],
    raw: true,
  });
}

const notify = (companyId, recipientUserIds, notification, excludeUserId) =>
  notificationService.notifyUsers({
    companyId,
    recipientUserIds: recipientUserIds.filter(
      (id) => Number(id) !== Number(excludeUserId),
    ),
    ...notification,
  });

// ---------------------------------------------------------------------------

function projectLeadAssigned({ companyId, projectId, leadEmployeeId, byUserId }) {
  return safely("PROJECT_LEAD_ASSIGNED", async () => {
    const project = await projectInfo(projectId, companyId);
    const recipients = await userIdsOfEmployees([leadEmployeeId], companyId);
    if (!project || !recipients.length) return;

    await notify(companyId, recipients, {
      type: "PROJECT_ASSIGNED",
      title: "New project assigned",
      message: `You are now the Project Lead of "${project.name}".`,
      link: "/project-lead/projects",
      eventKey: `project-lead-${project.id}-${leadEmployeeId}`,
      metadata: { projectUuid: project.uuid },
    }, byUserId);
  });
}

function bugAssigned({ companyId, projectId, bug, developerEmployeeId, byUserId }) {
  return safely("BUG_ASSIGNED", async () => {
    const project = await projectInfo(projectId, companyId);
    const recipients = await userIdsOfEmployees([developerEmployeeId], companyId);
    if (!project || !recipients.length) return;

    await notify(companyId, recipients, {
      type: "BUG_ASSIGNED",
      title: "New bug to fix",
      message: `"${bug.title}" in "${project.name}" was assigned to you.`,
      link: "/developer/bugs",
      eventKey: `bug-assigned-${bug.uuid}-${developerEmployeeId}`,
      metadata: { bugUuid: bug.uuid, projectUuid: project.uuid },
    }, byUserId);
  });
}

// reason: "reported" (tester found a new bug) | "reopened" (fix failed retest)
function bugToLead({ companyId, projectId, bug, reason, byUserId }) {
  return safely("BUG_TO_LEAD", async () => {
    const project = await projectInfo(projectId, companyId);
    const recipients = await leadUserIds(projectId, companyId);
    if (!project || !recipients.length) return;

    const reopened = reason === "reopened";

    await notify(companyId, recipients, {
      type: reopened ? "BUG_REOPENED" : "BUG_REPORTED",
      title: reopened ? "Bug came back from testing" : "New bug reported by tester",
      message: reopened
        ? `"${bug.title}" in "${project.name}" failed retest. Assign it to a developer again.`
        : `The tester reported "${bug.title}" in "${project.name}". Assign it to a developer.`,
      link: "/project-lead/bugs",
      eventKey: `bug-${reason}-${bug.uuid}-${Date.now()}`,
      metadata: { bugUuid: bug.uuid, projectUuid: project.uuid },
    }, byUserId);
  });
}

function retestRequested({ companyId, projectId, bug, byUserId }) {
  return safely("RETEST_REQUESTED", async () => {
    const project = await projectInfo(projectId, companyId);
    const recipients = await testerUserIds(projectId, companyId);
    if (!project || !recipients.length) return;

    await notify(companyId, recipients, {
      type: "RETEST_REQUESTED",
      title: "Bug ready for retest",
      message: `"${bug.title}" in "${project.name}" was fixed. Please retest it.`,
      link: "/tester/retesting",
      eventKey: `retest-${bug.uuid}-${Date.now()}`,
      metadata: { bugUuid: bug.uuid, projectUuid: project.uuid },
    }, byUserId);
  });
}

// Only people newly added — not everyone each time the team is saved
function teamMembersAdded({ companyId, projectId, developerEmployeeIds, testerEmployeeIds, byUserId }) {
  return safely("TEAM_ADDED", async () => {
    const project = await projectInfo(projectId, companyId);
    if (!project) return;

    const [developers, testers] = await Promise.all([
      userIdsOfEmployees(developerEmployeeIds, companyId),
      userIdsOfEmployees(testerEmployeeIds, companyId),
    ]);

    const base = {
      type: "TEAM_ADDED",
      title: "Added to a project team",
      metadata: { projectUuid: project.uuid },
    };

    if (developers.length) {
      await notify(companyId, developers, {
        ...base,
        message: `You were added as a developer on "${project.name}".`,
        link: "/developer/projects",
        eventKey: `team-dev-${project.id}-${Date.now()}`,
      }, byUserId);
    }

    if (testers.length) {
      await notify(companyId, testers, {
        ...base,
        message: `You were added as a tester on "${project.name}".`,
        link: "/tester/projects",
        eventKey: `team-tester-${project.id}-${Date.now()}`,
      }, byUserId);
    }
  });
}

function brdNeedsClientApproval({ companyId, brd }) {
  return safely("BRD_CLIENT_APPROVAL", async () => {
    if (!brd?.clientId) return;

    const client = await Client.findOne({
      where: { id: brd.clientId, companyId, isActive: true },
      attributes: ["userId"],
      raw: true,
    });
    if (!client?.userId) return;

    await notify(companyId, [client.userId], {
      type: "BRD_APPROVAL_NEEDED",
      title: "BRD ready for your approval",
      message: `"${brd.title}" is ready. Please review and approve it, or ask for changes.`,
      link: "/client/brd-approval",
      eventKey: `brd-client-approval-${brd.uuid}`,
      metadata: { brdUuid: brd.uuid },
    });
  });
}

function phaseCompleted({ companyId, projectId, phase, byUserId }) {
  return safely("PHASE_COMPLETED", async () => {
    const project = await projectInfo(projectId, companyId);
    if (!project) return;

    await notificationService.notifyAdmins({
      companyId,
      type: "PHASE_COMPLETED",
      title: "Phase completed",
      message: `Phase "${phase.name}" of "${project.name}" is completed.`,
      link: "/admin/projects",
      eventKey: `phase-completed-${phase.uuid}`,
      metadata: { phaseUuid: phase.uuid, projectUuid: project.uuid },
      excludeUserId: byUserId,
    });
  });
}

module.exports = {
  projectLeadAssigned,
  bugAssigned,
  bugToLead,
  retestRequested,
  teamMembersAdded,
  brdNeedsClientApproval,
  phaseCompleted,
};
