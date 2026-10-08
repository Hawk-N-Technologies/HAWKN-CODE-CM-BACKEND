const { Op } = require("@sequelize/core");

const Project = require("../models/Project");
const Client = require("../models/Client");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Role = require("../models/Role");

const MAX_ROWS = 1000; // safety cap until the list gets pagination
const DUE_SOON_DAYS = 14;
// A project is "closed" once it's in one of these — no overdue warnings
const CLOSED_STATUSES = ["Completed", "Cancelled"];
const DELETABLE_STATUSES = ["Planning", "Cancelled"];
const DUE_SOON_DAYS = 14;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getToday = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const toDateOrNull = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split("T")[0];
};

const dateOnly = (value) => {
  if (!value) return null;

  return String(value).slice(0, 10);
};

const fullName = (firstName, lastName) => {
  return [firstName, lastName].filter(Boolean).join(" ");
};

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

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
    uuid: project.uuid,
    name: project.name,
    tier: project.tier,
    status: project.status,
    progress: Number(project.progress),
    description: project.description,

    startDate: dateOnly(project.startDate),
    deadline,
    internalDeadline: dateOnly(project.internalDeadline),

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,

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
      ? { uuid: row.leadUuid, fullName: fullName(row.leadFirstName, row.leadLastName), email: row.leadEmail }
      : null,
  };
};

// --------------------------------------------------
// Validate + prepare project data
// --------------------------------------------------

const prepareProjectData = async (companyId, data, currentProject = null) => {
  const errors = {};

  // Client: active client (client row + its user) of THIS company,
  // or the project's current client even if since deactivated
  const [client] = await select(
    `SELECT c.id
       FROM clients c
       JOIN users u ON u.id = c.user_id
      WHERE c.uuid = :clientUuid AND c.company_id = :companyId
        AND ((c.is_active = TRUE AND u.is_active = TRUE) OR c.id = :currentClientId)`,
    { clientUuid: data.clientUuid, companyId, currentClientId: current?.clientId ?? -1 },
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
      { leadUuid: data.projectLeadUuid, companyId, currentLeadId: current?.projectLeadId ?? -1 },
      transaction,
    );
    if (!lead) errors.projectLeadUuid = "Select an active developer as project lead";
    else leadId = lead.id;
  }

  const formattedStartDate = toDateOrNull(startDate);

  const formattedDeadline = toDateOrNull(deadline);

  const formattedInternalDeadline = toDateOrNull(internalDeadline);

  if (
    formattedStartDate &&
    formattedDeadline &&
    formattedDeadline < formattedStartDate
  ) {
    errors.deadline = "Deadline can't be before the start date";
  }

  if (
    formattedInternalDeadline &&
    formattedStartDate &&
    formattedInternalDeadline < formattedStartDate
  ) {
    errors.internalDeadline =
      "Internal deadline can't be before the start date";
  }

  if (
    formattedInternalDeadline &&
    formattedDeadline &&
    formattedInternalDeadline > formattedDeadline
  ) {
    errors.internalDeadline =
      "Internal deadline should be on or before the client deadline";
  }

  // --------------------------------------------------
  // Validation errors
  // --------------------------------------------------

  if (Object.keys(errors).length > 0) {
    const error = createError("Validation failed.", 400);

    error.errors = Object.entries(errors).map(([field, message]) => ({
      field,
      message,
    }));

    throw error;
  }

  // --------------------------------------------------
  // Duplicate project name for same client
  // --------------------------------------------------

  const duplicateWhere = {
    companyId,
    clientId: client.id,

    name: {
      [Op.iLike]: name,
    },
  };

  if (currentProject?.id) {
    duplicateWhere.id = {
      [Op.ne]: currentProject.id,
    };
  }

  const duplicateProject = await Project.findOne({
    where: duplicateWhere,
  });

  if (duplicateProject) {
    const error = createError("Validation failed.", 409);

    error.errors = [
      {
        field: "name",
        message: "This client already has a project with this name",
      },
    ];

    throw error;
  }

  // --------------------------------------------------
  // Completed project = 100%
  // --------------------------------------------------

  const finalProgress = status === "Completed" ? 100 : progress;

  return {
    clientId: client.id,
    projectLeadId,

    name,
    tier,

    startDate: formattedStartDate,
    deadline: formattedDeadline,
    internalDeadline: formattedInternalDeadline,

    status,
    progress: finalProgress,

    description: description?.trim() || null,
  };
};

// --------------------------------------------------
// Common includes
// --------------------------------------------------

const projectIncludes = [
  {
    model: Client,
    as: "client",

    include: [
      {
        model: User,
        as: "user",

        attributes: [
          "id",
          "firstName",
          "lastName",
          "first_name",
          "last_name",
          "email",
        ],
      },
    ],
  },

  {
    model: Employee,
    as: "projectLead",

    include: [
      {
        model: User,
        as: "user",

        attributes: [
          "id",
          "firstName",
          "lastName",
          "first_name",
          "last_name",
          "email",
        ],
      },
    ],
  },
];

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
};

// --------------------------------------------------
// Get all projects
// --------------------------------------------------

const getProjects = async (companyId, status) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  const where = {
    companyId,
  };

  if (status) {
    where.status = status;
  }

  const projects = await Project.findAll({
    where,

    include: projectIncludes,

    order: [
      ["deadline", "ASC"],
      ["createdAt", "DESC"],
    ],

    limit: 1000,
  });

  return projects.map(formatProject);
};

// --------------------------------------------------
// Get one project
// --------------------------------------------------

const getProjectByUuid = async (companyId, uuid) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  if (!uuid) {
    throw createError("Project UUID is required", 400);
  }

  const project = await Project.findOne({
    where: {
      uuid,
      companyId,
    },

    include: projectIncludes,
  });

  if (!project) {
    throw createError("Project not found", 404);
  }

  return formatProject(project);
};

// --------------------------------------------------
// Create project
// --------------------------------------------------

const createProject = async (companyId, data) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  if (!data || typeof data !== "object") {
    throw createError("Project data is required", 400);
  }

  if (!data.name?.trim()) {
    throw createError("Project name is required", 400);
  }

  const values = await prepareProjectData(companyId, data);

  const project = await Project.create({
    companyId,
    ...values,
  });

  return getProjectByUuid(companyId, project.uuid);
};

// --------------------------------------------------
// Update project
// --------------------------------------------------

const updateProject = async (companyId, uuid, data) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  if (!uuid) {
    throw createError("Project UUID is required", 400);
  }

  if (!data || typeof data !== "object") {
    throw createError("Project data is required", 400);
  }

  const project = await Project.findOne({
    where: {
      uuid,
      companyId,
    },
  });

  if (!project) {
    throw createError("Project not found", 404);
  }

  if (!data.name?.trim()) {
    throw createError("Project name is required", 400);
  }

  const values = await prepareProjectData(companyId, data, project);

  await project.update(values);

  return getProjectByUuid(companyId, uuid);
};

// --------------------------------------------------
// Delete project
// --------------------------------------------------

const deleteProject = async (companyId, uuid) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  if (!uuid) {
    throw createError("Project UUID is required", 400);
  }

  const project = await Project.findOne({
    where: {
      uuid,
      companyId,
    },
  });

  if (!project) {
    throw createError("Project not found", 404);
  }

  if (!DELETABLE_STATUSES.includes(project.status)) {
    throw createError(
      `A project that is "${project.status}" can't be deleted — only Planning or Cancelled projects can. Cancel it first if it's no longer needed.`,
      409,
    );
  }

  await project.destroy();

  return {
    message: "Project deleted successfully",
  };
};

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  getProjectOptions,
  getProjects,
  getProjectByUuid,
  createProject,
  updateProject,
  deleteProject,
};
