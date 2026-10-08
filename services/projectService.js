const { QueryTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const Project = require("../models/Project");
const logger = require("../utils/logger");

const MAX_ROWS = 1000; // safety cap until the list gets pagination
const DUE_SOON_DAYS = 14;
// A project is "closed" once it's in one of these — no overdue warnings
const CLOSED_STATUSES = ["Completed", "Cancelled"];
// Only projects that never really started can be deleted
const DELETABLE_STATUSES = ["Planning", "Cancelled"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function httpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Joi date (Date object) / "" / null → "YYYY-MM-DD" or null
const toDateOrNull = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : null;
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);
const fullName = (first, last) => [first, last].filter(Boolean).join(" ");

const daysBetween = (from, to) =>
  `Math.round((Date.parse(${to}T00:00:00Z) - Date.parse(${from}T00:00:00Z)) / 86400000)`;

const select = (sql, replacements, transaction) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });

const LIST_SQL = `
  SELECT p.uuid, p.name, p.tier, p.status, p.progress, p.description,
         p.start_date        AS "startDate",
         p.deadline,
         p.internal_deadline AS "internalDeadline",
         p.created_at        AS "createdAt",
         p.updated_at        AS "updatedAt",
         c.uuid              AS "clientUuid",
         c.phone             AS "clientPhone",
         cu.first_name       AS "clientFirstName",
         cu.last_name        AS "clientLastName",
         cu.email            AS "clientEmail",
         le.uuid             AS "leadUuid",
         lu.first_name       AS "leadFirstName",
         lu.last_name        AS "leadLastName",
         lu.email            AS "leadEmail"
    FROM projects p
    -- A client IS a user (clients.user_id): name + email live on users
    JOIN clients c         ON c.id = p.client_id
    JOIN users cu          ON cu.id = c.user_id
    LEFT JOIN employees le ON le.id = p.project_lead_id
    LEFT JOIN users lu     ON lu.id = le.user_id
   WHERE p.company_id = :companyId
`;

function toResponse(row) {
  const today = todayIst();
  const deadline = dateOnly(row.deadline);
  const isOpen = !CLOSED_STATUSES.includes(row.status);
  const daysLeft = isOpen && deadline ? daysBetween(today, deadline) : null;

  return {
    uuid: row.uuid,
    name: row.name,
    tier: row.tier,
    status: row.status,
    progress: Number(row.progress),
    description: row.description,
    startDate: dateOnly(row.startDate),
    deadline,
    internalDeadline: dateOnly(row.internalDeadline),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Only open projects with a deadline can be late
    daysLeft,
    isOverdue: daysLeft !== null && daysLeft < 0,
    isDueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    canDelete: DELETABLE_STATUSES.includes(row.status),
    client: {
      uuid: row.clientUuid,
      name: fullName(row.clientFirstName, row.clientLastName),
      email: row.clientEmail,
      phone: row.clientPhone,
    },
    projectLead: row.leadUuid
      ? {
          uuid: row.leadUuid,
          fullName: fullName(row.leadFirstName, row.leadLastName),
          email: row.leadEmail,
        }
      : null,
  };
}

async function getOne(uuid, companyId) {
  const [row] = await select(
    `${LIST_SQL} AND p.uuid = :uuid, { companyId, uuid }`,
  );
  return row ? toResponse(row) : null;
}

/**
 * Turns the request into DB-ready values and checks everything the DB
 * can't explain nicely. current = the project being edited (or null):
 * its existing client / lead stay allowed even if since deactivated.
 */
async function prepare(companyId, data, current, transaction) {
  const errors = {};

  // Client: active client (client row + its user) of THIS company,
  // or the project's current client even if since deactivated
  const [client] = await select(
    `SELECT c.id
       FROM clients c
       JOIN users u ON u.id = c.user_id
      WHERE c.uuid = :clientUuid AND c.company_id = :companyId
        AND ((c.is_active = TRUE AND u.is_active = TRUE) OR c.id = :currentClientId)`,
    {
      clientUuid: data.clientUuid,
      companyId,
      currentClientId: current?.clientId ?? -1,
    },
    transaction,
  );
  if (!client) errors.clientUuid = "Select an active client from the list";

  // Lead: an ACTIVE DEVELOPER employee of THIS company (or the project's
  // current lead, even if they've since left / changed role).
  // project_lead_id stores employees.id — the UUID from the form is
  // looked up here, never trusted as an id.
  let leadId = null;
  if (data.projectLeadUuid) {
    const [lead] = await select(
      `SELECT e.id
         FROM employees e
         JOIN users u ON u.id = e.user_id
         JOIN roles r ON r.id = u.role_id
        WHERE e.uuid = :leadUuid AND e.company_id = :companyId
          AND (
                (r.name = 'developer' AND e.employment_status <> 'Exited' AND u.is_active = TRUE)
                OR e.id = :currentLeadId
              )`,
      {
        leadUuid: data.projectLeadUuid,
        companyId,
        currentLeadId: current?.projectLeadId ?? -1,
      },
      transaction,
    );
    if (!lead)
      errors.projectLeadUuid = "Select an active developer as project lead";
    else leadId = lead.id;
  }

  const startDate = toDateOrNull(data.startDate);
  const deadline = toDateOrNull(data.deadline);
  const internalDeadline = toDateOrNull(data.internalDeadline);

  if (startDate && deadline && deadline < startDate) {
    errors.deadline = "Deadline can't be before the start date";
  }
  if (internalDeadline && startDate && internalDeadline < startDate) {
    errors.internalDeadline =
      "Internal deadline can't be before the start date";
  }
  if (internalDeadline && deadline && internalDeadline > deadline) {
    errors.internalDeadline =
      "Internal deadline should be on or before the client deadline";
  }

  if (Object.keys(errors).length) {
    // Same shape as the validate middleware: [{ field, message }]
    const error = httpError(400, "Validation failed.");
    error.errors = Object.entries(errors).map(([field, message]) => ({
      field,
      message,
    }));
    throw error;
  }

  // Same name twice for the same client is almost always a mistake
  const [duplicate] = await select(
    `SELECT 1 FROM projects
      WHERE company_id = :companyId AND client_id = :clientId
        AND LOWER(name) = LOWER(:name) AND id <> :currentId
      LIMIT 1`,
    {
      companyId,
      clientId: client.id,
      name: data.name,
      currentId: current?.id ?? -1,
    },
    transaction,
  );
  if (duplicate) {
    const error = httpError(409, "Validation failed.");
    error.errors = [
      {
        field: "name",
        message: "This client already has a project with this name",
      },
    ];
    throw error;
  }

  // A completed project is 100% done
  const progress = data.status === "Completed" ? 100 : data.progress;

  return {
    clientId: client.id,
    projectLeadId: leadId,
    name: data.name,
    tier: data.tier,
    startDate,
    deadline,
    internalDeadline,
    status: data.status,
    progress,
    description: data.description ? data.description.trim() || null : null,
  };
}

async function findProjectRow(uuid, companyId, transaction) {
  const [row] = await select(
    `SELECT id, client_id AS "clientId", project_lead_id AS "projectLeadId", status
       FROM projects WHERE uuid = :uuid AND company_id = :companyId
       FOR UPDATE`,
    { uuid, companyId },
    transaction,
  );
  if (!row) throw httpError(404, "Project not found");
  return row;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Dropdown data for the form: active clients + available project leads
async function getOptions(companyId) {
  const clients = await select(
    `SELECT c.uuid, u.first_name AS "firstName", u.last_name AS "lastName", u.email
       FROM clients c
       JOIN users u ON u.id = c.user_id
      WHERE c.company_id = :companyId
        AND c.is_active = TRUE
        AND u.is_active = TRUE
      ORDER BY u.first_name, u.last_name`,
    { companyId },
  );

  // Project lead = an active DEVELOPER employee (senior's rule)
  const projectLeads = await select(
    `SELECT e.uuid, u.first_name AS "firstName", u.last_name AS "lastName", u.email
       FROM employees e
       JOIN users u ON u.id = e.user_id
       JOIN roles r ON r.id = u.role_id
      WHERE e.company_id = :companyId
        AND r.name = 'developer'
        AND e.employment_status <> 'Exited'
        AND u.is_active = TRUE
      ORDER BY u.first_name, u.last_name`,
    { companyId },
  );

  return {
    clients: clients.map((client) => ({
      uuid: client.uuid,
      name: fullName(client.firstName, client.lastName),
      email: client.email,
    })),
    projectLeads: projectLeads.map((lead) => ({
      uuid: lead.uuid,
      fullName: fullName(lead.firstName, lead.lastName),
      email: lead.email,
    })),
  };
}

async function listProjects(companyId, { status } = {}) {
  try {
    const rows = await select(
      `${LIST_SQL}
       ${status ? "AND p.status = :status" : ""}
       ORDER BY (p.status IN ('Completed', 'Cancelled')), p.deadline ASC NULLS LAST, p.created_at DESC
       LIMIT :limit`,
      { companyId, status: status ?? null, limit: MAX_ROWS },
    );

    logger.info("Projects fetched", { companyId, count: rows.length });
    return rows.map(toResponse);
  } catch (error) {
    logger.error("Failed to fetch projects", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function getProject(uuid, companyId) {
  const project = await getOne(uuid, companyId);
  if (!project) throw httpError(404, "Project not found");
  return project;
}

async function createProject(companyId, data) {
  try {
    const uuid = await sequelize.transaction(async (transaction) => {
      const values = await prepare(companyId, data, null, transaction);
      const project = await Project.create(
        { companyId, ...values },
        { transaction },
      );
      return project.uuid;
    });

    logger.info("Project created", { companyId, uuid });
    return getOne(uuid, companyId);
  } catch (error) {
    logger.error("Failed to create project", {
      companyId,
      error: error.message,
    });
    throw error;
  }
}

async function updateProject(uuid, companyId, data) {
  try {
    await sequelize.transaction(async (transaction) => {
      const current = await findProjectRow(uuid, companyId, transaction);
      const values = await prepare(companyId, data, current, transaction);
      await Project.update(values, { where: { id: current.id }, transaction });
    });

    logger.info("Project updated", { companyId, uuid });
    return getOne(uuid, companyId);
  } catch (error) {
    logger.error("Failed to update project", {
      companyId,
      uuid,
      error: error.message,
    });
    throw error;
  }
}

// Only Planning / Cancelled — anything further along is real work history
async function deleteProject(uuid, companyId) {
  try {
    await sequelize.transaction(async (transaction) => {
      const current = await findProjectRow(uuid, companyId, transaction);
      if (!DELETABLE_STATUSES.includes(current.status)) {
        throw httpError(
          409,
          `A project that is "${current.status}" can't be deleted — only Planning or Cancelled projects can. Cancel it first if it's no longer needed.`,
        );
      }
      await Project.destroy({ where: { id: current.id }, transaction });
    });

    logger.info("Project deleted", { companyId, uuid });
  } catch (error) {
    logger.error("Failed to delete project", {
      companyId,
      uuid,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  getOptions,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};
