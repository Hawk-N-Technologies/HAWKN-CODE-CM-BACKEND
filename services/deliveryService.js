"use strict";

/**
 * Delivery & Handover
 *
 *   Tester  submits a delivery (live link, how-to docs, deliverables)
 *   Admin   approves it  → the client sees it
 *           or sends it back to the tester with a note → tester fixes, resubmits
 *   Client  accepts it   → the project becomes Completed (progress 100%)
 *           or asks for a follow-up → a "Change Request" ticket (issue_reports),
 *           and the tester submits a new delivery once it's done
 *
 * The codebase / repository is never part of a delivery, and is never sent
 * to the client.
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
  ProjectDelivery,
} = require("../models/associations");
const IssueReport = require("../models/IssueReport");
const ProjectDeployment = require("../models/ProjectDeployment");

const STATUS = {
  PENDING: "Pending Admin Approval",
  SENT_BACK: "Sent Back",
  WITH_CLIENT: "Sent to Client",
  ACCEPTED: "Accepted",
  FOLLOW_UP: "Follow-up Requested",
};

// A project can only have one of these at a time
const OPEN_STATUSES = [STATUS.PENDING, STATUS.SENT_BACK, STATUS.WITH_CLIENT];

// The client only ever sees deliveries Admin has approved
const CLIENT_STATUSES = [STATUS.WITH_CLIENT, STATUS.ACCEPTED, STATUS.FOLLOW_UP];

const CLOSED_PROJECT_STATUSES = ["Completed", "Cancelled"];
const MAX_ROWS = 500;

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || null;

// "app.example.com" → "https://app.example.com" (deployment stores bare domains)
const asLink = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const cleanFields = (body) => ({
  versionLabel: body.versionLabel?.trim() || null,
  liveUrl: body.liveUrl.trim(),
  deliverables: body.deliverables.map((item) => item.trim()),
  docs: (body.docs || []).map((doc) => ({ title: doc.title.trim(), url: doc.url.trim() })),
  notes: body.notes?.trim() || null,
});

// ---------------------------------------------------------------------------
// Who can see / act on what
// ---------------------------------------------------------------------------

async function testerProjectIdsOf(user) {
  const employee = await findActiveEmployee(user.userId, user.companyId);
  if (!employee) return [];
  return getTesterProjectIds(employee.id, user.companyId);
}

async function clientOf(user) {
  return Client.findOne({
    where: { userId: user.userId, companyId: user.companyId, isActive: true },
    attributes: ["id"],
  });
}

const deliveryInclude = [
  {
    model: Project,
    as: "project",
    attributes: ["id", "uuid", "name", "status", "clientId"],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id"],
        include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "email"] }],
      },
    ],
  },
  { model: User, as: "submitter", attributes: ["firstName", "lastName", "email"] },
  { model: IssueReport, as: "followUpIssue", attributes: ["uuid", "title", "status"] },
];

// What each role gets back. Clients never see internal notes or ids.
function toResponse(delivery, role) {
  const base = {
    uuid: delivery.uuid,
    project: {
      uuid: delivery.project?.uuid ?? null,
      name: delivery.project?.name ?? "—",
      status: delivery.project?.status ?? null,
    },
    versionLabel: delivery.versionLabel,
    liveUrl: delivery.liveUrl,
    deliverables: delivery.deliverables || [],
    docs: delivery.docs || [],
    notes: delivery.notes,
    status: delivery.status,
    sentToClientAt:
      CLIENT_STATUSES.includes(delivery.status) ? delivery.reviewedAt : null,
    clientRespondedAt: delivery.clientRespondedAt,
    followUp: delivery.followUpIssue
      ? {
          uuid: delivery.followUpIssue.uuid,
          title: delivery.followUpIssue.title,
          status: delivery.followUpIssue.status,
        }
      : null,
  };

  if (role === "client") return base;

  return {
    ...base,
    clientName: fullName(delivery.project?.client?.user) || "—",
    submittedBy: fullName(delivery.submitter),
    submittedAt: delivery.submittedAt,
    adminNote: delivery.adminNote,
    reviewedAt: delivery.reviewedAt,
    createdAt: delivery.createdAt,
  };
}

// Load one delivery the user is allowed to see (404 otherwise — no leaking)
async function findVisibleDelivery(user, uuid, { transaction, lock } = {}) {
  const delivery = await ProjectDelivery.findOne({
    where: { uuid, companyId: user.companyId },
    transaction,
    lock,
  });

  if (!delivery) throw httpError(404, "Delivery not found.");

  if (user.role === "tester") {
    const ids = await testerProjectIdsOf(user);
    if (!ids.some((id) => Number(id) === Number(delivery.projectId))) {
      throw httpError(404, "Delivery not found.");
    }
  }

  if (user.role === "client") {
    const client = await clientOf(user);
    const project = await Project.findOne({
      where: { id: delivery.projectId, companyId: user.companyId },
      attributes: ["clientId"],
      transaction,
    });

    if (
      !client ||
      Number(project?.clientId) !== Number(client.id) ||
      !CLIENT_STATUSES.includes(delivery.status)
    ) {
      throw httpError(404, "Delivery not found.");
    }
  }

  return delivery;
}

async function reload(delivery, role) {
  const full = await ProjectDelivery.findOne({
    where: { id: delivery.id },
    include: deliveryInclude,
  });
  return toResponse(full, role);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function listDeliveries(user) {
  const where = { companyId: user.companyId };

  if (user.role === "tester") {
    const ids = await testerProjectIdsOf(user);
    if (!ids.length) return [];
    where.projectId = { [Op.in]: ids };
  }

  if (user.role === "client") {
    const client = await clientOf(user);
    if (!client) return [];

    const projects = await Project.findAll({
      where: { companyId: user.companyId, clientId: client.id },
      attributes: ["id"],
      raw: true,
    });
    if (!projects.length) return [];

    where.projectId = { [Op.in]: projects.map((project) => project.id) };
    where.status = { [Op.in]: CLIENT_STATUSES };
  }

  const rows = await ProjectDelivery.findAll({
    where,
    include: deliveryInclude,
    order: [["updatedAt", "DESC"]],
    limit: MAX_ROWS,
  });

  return rows.map((row) => toResponse(row, user.role));
}

// Tester's projects for the "Submit delivery" form, with the live link and
// docs link from Deployment Planning to start from
async function testerProjects(user) {
  const ids = await testerProjectIdsOf(user);
  if (!ids.length) return [];

  const [projects, deployments, open] = await Promise.all([
    Project.findAll({
      where: { id: { [Op.in]: ids }, companyId: user.companyId },
      attributes: ["id", "uuid", "name", "status"],
      order: [["name", "ASC"]],
    }),
    ProjectDeployment.findAll({
      where: { projectId: { [Op.in]: ids }, companyId: user.companyId },
      attributes: ["projectId", "liveDomain", "documentationUrl"],
      raw: true,
    }),
    ProjectDelivery.findAll({
      where: {
        projectId: { [Op.in]: ids },
        companyId: user.companyId,
        status: { [Op.in]: OPEN_STATUSES },
      },
      attributes: ["projectId", "status"],
      raw: true,
    }),
  ]);

  return projects.map((project) => {
    const deployment = deployments.find((row) => Number(row.projectId) === Number(project.id));
    const openDelivery = open.find((row) => Number(row.projectId) === Number(project.id));

    return {
      uuid: project.uuid,
      name: project.name,
      status: project.status,
      suggestedLiveUrl: asLink(deployment?.liveDomain),
      suggestedDocUrl: asLink(deployment?.documentationUrl),
      openDeliveryStatus: openDelivery?.status ?? null,
      canSubmit:
        !openDelivery && !CLOSED_PROJECT_STATUSES.includes(project.status),
    };
  });
}

// ---------------------------------------------------------------------------
// Tester
// ---------------------------------------------------------------------------

async function createDelivery(user, body) {
  const created = await sequelize.transaction(async (transaction) => {
    // Lock the project row so two testers can't both open a delivery
    const project = await Project.findOne({
      where: { uuid: body.projectId, companyId: user.companyId },
      attributes: ["id", "uuid", "name", "status"],
      transaction,
      lock: true,
    });

    const ids = project ? await testerProjectIdsOf(user) : [];
    if (!project || !ids.some((id) => Number(id) === Number(project.id))) {
      throw httpError(404, "Project not found.");
    }

    if (CLOSED_PROJECT_STATUSES.includes(project.status)) {
      throw httpError(409, `This project is already ${project.status.toLowerCase()}.`);
    }

    const open = await ProjectDelivery.findOne({
      where: { projectId: project.id, status: { [Op.in]: OPEN_STATUSES } },
      attributes: ["id"],
      transaction,
    });

    if (open) {
      throw httpError(409, "This project already has a delivery in progress.");
    }

    return ProjectDelivery.create(
      {
        ...cleanFields(body),
        companyId: user.companyId,
        projectId: project.id,
        status: STATUS.PENDING,
        submittedBy: user.userId,
        submittedAt: new Date(),
      },
      { transaction },
    );
  });

  await events.deliverySubmitted(created);
  return reload(created, user.role);
}

// Fix and resubmit a delivery Admin sent back
async function updateDelivery(user, uuid, body) {
  const saved = await sequelize.transaction(async (transaction) => {
    const delivery = await findVisibleDelivery(user, uuid, { transaction, lock: true });

    if (delivery.status !== STATUS.SENT_BACK) {
      throw httpError(409, "Only a delivery that was sent back can be edited.");
    }

    await delivery.update(
      {
        ...cleanFields(body),
        status: STATUS.PENDING,
        submittedBy: user.userId,
        submittedAt: new Date(),
      },
      { transaction },
    );

    return delivery;
  });

  await events.deliverySubmitted(saved);
  return reload(saved, user.role);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

async function reviewDelivery(user, uuid, { approve, note }) {
  const saved = await sequelize.transaction(async (transaction) => {
    const delivery = await findVisibleDelivery(user, uuid, { transaction, lock: true });

    if (delivery.status !== STATUS.PENDING) {
      throw httpError(409, "This delivery is not waiting for approval.");
    }

    await delivery.update(
      {
        status: approve ? STATUS.WITH_CLIENT : STATUS.SENT_BACK,
        adminNote: approve ? null : note.trim(),
        reviewedBy: user.userId,
        reviewedAt: new Date(),
      },
      { transaction },
    );

    return delivery;
  });

  if (approve) await events.deliveryApproved(saved);
  else await events.deliverySentBack(saved);

  return reload(saved, user.role);
}

const approveDelivery = (user, uuid) => reviewDelivery(user, uuid, { approve: true });
const sendBackDelivery = (user, uuid, note) =>
  reviewDelivery(user, uuid, { approve: false, note });

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

async function acceptDelivery(user, uuid) {
  const saved = await sequelize.transaction(async (transaction) => {
    const delivery = await findVisibleDelivery(user, uuid, { transaction, lock: true });

    if (delivery.status !== STATUS.WITH_CLIENT) {
      throw httpError(409, "This delivery has already been answered.");
    }

    await delivery.update(
      { status: STATUS.ACCEPTED, clientRespondedAt: new Date() },
      { transaction },
    );

    // Accepting the delivery completes the project
    await Project.update(
      { status: "Completed", progress: 100 },
      { where: { id: delivery.projectId, companyId: user.companyId }, transaction },
    );

    return delivery;
  });

  await events.deliveryAccepted(saved);
  return reload(saved, user.role);
}

// Follow-up = the same "Change Request" ticket the client raises from Bugs
async function requestFollowUp(user, uuid, body) {
  const saved = await sequelize.transaction(async (transaction) => {
    const delivery = await findVisibleDelivery(user, uuid, { transaction, lock: true });

    if (delivery.status !== STATUS.WITH_CLIENT) {
      throw httpError(409, "This delivery has already been answered.");
    }

    const label = delivery.versionLabel ? ` ${delivery.versionLabel}` : "";
    const description = [body.description?.trim(), `— Raised from delivery${label}`]
      .filter(Boolean)
      .join("\n\n");

    const issue = await IssueReport.create(
      {
        projectId: delivery.projectId,
        title: body.title.trim(),
        description,
        classification: "Change Request",
        severity: body.severity || "Medium",
        status: "Under Review",
        reportedBy: user.userId,
      },
      { transaction },
    );

    await delivery.update(
      {
        status: STATUS.FOLLOW_UP,
        clientRespondedAt: new Date(),
        followUpIssueId: issue.id,
      },
      { transaction },
    );

    return delivery;
  });

  await events.deliveryFollowUp(saved);
  return reload(saved, user.role);
}

module.exports = {
  STATUS,
  listDeliveries,
  testerProjects,
  createDelivery,
  updateDelivery,
  approveDelivery,
  sendBackDelivery,
  acceptDelivery,
  requestFollowUp,
};
