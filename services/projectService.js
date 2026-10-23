const { Op } = require("@sequelize/core");

const Project = require("../models/Project");
const Client = require("../models/Client");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Role = require("../models/Role");

const logger = require("../utils/logger");

// --------------------------------------------------
// Constants
// --------------------------------------------------

const MAX_ROWS = 1000;

const DUE_SOON_DAYS = 14;

const CLOSED_STATUSES = ["Completed", "Cancelled"];

const DELETABLE_STATUSES = ["Planning", "Cancelled"];

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function createError(message, statusCode = 400, errors = null) {
  const error = new Error(message);

  error.statusCode = statusCode;

  if (errors) {
    error.errors = errors;
  }

  return error;
}

function getToday() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDateOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split("T")[0];
}

function dateOnly(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 10);
}

function fullName(firstName, lastName) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function daysBetween(from, to) {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );
}

// --------------------------------------------------
// Project Includes
// --------------------------------------------------

const projectIncludes = [
  {
    model: Client,
    as: "client",
    required: true,

    include: [
      {
        model: User,
        as: "user",
        required: true,

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
    required: false,

    include: [
      {
        model: User,
        as: "user",
        required: true,

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

// --------------------------------------------------
// Format Project Response
// --------------------------------------------------

function formatProject(project) {
  const today = getToday();

  const deadline = dateOnly(project.deadline);

  const isOpen = !CLOSED_STATUSES.includes(project.status);

  const daysLeft = isOpen && deadline ? daysBetween(today, deadline) : null;

  const client = project.client;

  const projectLead = project.projectLead;

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

    canDelete: DELETABLE_STATUSES.includes(project.status),

    client: client
      ? {
          uuid: client.uuid,

          name: client.user
            ? fullName(
                client.user.firstName || client.user.first_name,
                client.user.lastName || client.user.last_name,
              )
            : null,

          contactPerson: client.user
            ? fullName(
                client.user.firstName || client.user.first_name,
                client.user.lastName || client.user.last_name,
              )
            : null,

          email: client.user?.email || null,

          phone: client.phone || null,
        }
      : null,

    projectLead: projectLead
      ? {
          uuid: projectLead.uuid,

          fullName: projectLead.user
            ? fullName(
                projectLead.user.firstName || projectLead.user.first_name,
                projectLead.user.lastName || projectLead.user.last_name,
              )
            : null,

          email: projectLead.user?.email || null,
        }
      : null,
  };
}

// --------------------------------------------------
// Prepare Project Data
// --------------------------------------------------

async function prepareProjectData(companyId, data, currentProject = null) {
  const errors = {};

  const {
    clientUuid,
    projectLeadUuid,
    name,
    tier,
    startDate,
    deadline,
    internalDeadline,
    status,
    progress,
    description,
  } = data;

  // --------------------------------------------------
  // Client
  // --------------------------------------------------

  const clientWhere = {
    uuid: clientUuid,
    companyId,
    isActive: true,
  };

  /*
   * During update:
   * The project's existing client can remain selected
   * even if the client was later deactivated.
   */
  if (currentProject?.clientId) {
    clientWhere[Op.or] = [
      {
        isActive: true,
      },
      {
        id: currentProject.clientId,
      },
    ];
  }

  const client = await Client.findOne({
    where: clientWhere,
  });

  if (!client) {
    errors.clientUuid = "Select an active client from the list";
  }

  // --------------------------------------------------
  // Project Lead
  // --------------------------------------------------

  let projectLeadId = null;

  if (projectLeadUuid) {
    const leadWhere = {
      uuid: projectLeadUuid,

      companyId,

      employmentStatus: {
        [Op.ne]: "Exited",
      },
    };

    /*
     * During update:
     * Existing project lead is still allowed even if
     * they later become inactive/exited.
     */
    if (currentProject?.projectLeadId) {
      leadWhere[Op.or] = [
        {
          employmentStatus: {
            [Op.ne]: "Exited",
          },
        },
        {
          id: currentProject.projectLeadId,
        },
      ];
    }

    const projectLead = await Employee.findOne({
      where: leadWhere,

      include: [
        {
          model: User,
          as: "user",

          required: true,

          where: {
            isActive: true,
          },

          include: [
            {
              model: Role,
              as: "role",

              required: true,

              where: {
                name: "developer",
              },
            },
          ],
        },
      ],
    });

    if (!projectLead) {
      errors.projectLeadUuid = "Select a project lead from the list";
    } else {
      projectLeadId = projectLead.id;
    }
  }

  // --------------------------------------------------
  // Dates
  // --------------------------------------------------

  const formattedStartDate = toDateOrNull(startDate);

  const formattedDeadline = toDateOrNull(deadline);

  const formattedInternalDeadline = toDateOrNull(internalDeadline);

  // --------------------------------------------------
  // Date Validation
  // --------------------------------------------------

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
  // Validation Errors
  // --------------------------------------------------

  if (Object.keys(errors).length > 0) {
    throw createError(
      "Validation failed.",
      400,
      Object.entries(errors).map(([field, message]) => ({
        field,
        message,
      })),
    );
  }

  // --------------------------------------------------
  // Duplicate Project Name
  // --------------------------------------------------

  const duplicateWhere = {
    companyId,

    clientId: client.id,

    name: {
      [Op.iLike]: name,
    },
  };

  /*
   * During update, don't compare the project
   * against itself.
   */
  if (currentProject?.id) {
    duplicateWhere.id = {
      [Op.ne]: currentProject.id,
    };
  }

  const duplicateProject = await Project.findOne({
    where: duplicateWhere,
  });

  if (duplicateProject) {
    throw createError("Validation failed.", 409, [
      {
        field: "name",
        message: "This client already has a project with this name",
      },
    ]);
  }

  // --------------------------------------------------
  // Completed Project = 100%
  // --------------------------------------------------

  const finalProgress = status === "Completed" ? 100 : progress;

  // --------------------------------------------------
  // DB Ready Values
  // --------------------------------------------------

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
}

// --------------------------------------------------
// Get Project Options
// --------------------------------------------------

async function getOptions(companyId) {
  try {
    if (!companyId) {
      throw createError("Company ID is required", 400);
    }

    // --------------------------------------------------
    // Clients
    // --------------------------------------------------

    const clients = await Client.findAll({
      where: {
        companyId,
        isActive: true,
      },

      include: [
        {
          model: User,
          as: "user",

          required: true,

          where: {
            isActive: true,
          },

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

      order: [["id", "ASC"]],
    });

    // --------------------------------------------------
    // Project Leads
    // --------------------------------------------------

    const projectLeads = await Employee.findAll({
      where: {
        companyId,

        employmentStatus: {
          [Op.ne]: "Exited",
        },
      },

      include: [
        {
          model: User,
          as: "user",

          required: true,

          where: {
            isActive: true,
          },

          attributes: [
            "id",
            "firstName",
            "lastName",
            "first_name",
            "last_name",
            "email",
          ],

          include: [
            {
              model: Role,
              as: "role",

              required: true,

              where: {
                name: "developer",
              },

              attributes: ["id", "name"],
            },
          ],
        },
      ],

      order: [["id", "ASC"]],
    });

    return {
      clients: clients.map((client) => ({
        uuid: client.uuid,

        name: client.user
          ? fullName(
              client.user.firstName || client.user.first_name,
              client.user.lastName || client.user.last_name,
            )
          : null,

        contactPerson: client.user
          ? fullName(
              client.user.firstName || client.user.first_name,
              client.user.lastName || client.user.last_name,
            )
          : null,

        email: client.user?.email || null,
      })),

      projectLeads: projectLeads.map((employee) => ({
        uuid: employee.uuid,

        fullName: employee.user
          ? fullName(
              employee.user.firstName || employee.user.first_name,
              employee.user.lastName || employee.user.last_name,
            )
          : null,

        email: employee.user?.email || null,
      })),
    };
  } catch (error) {
    logger.error("Failed to fetch project options", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Get All Projects
// --------------------------------------------------

const PROJECT_SORT_FIELDS = {
  name: "name",
  status: "status",
  tier: "tier",
  startDate: "startDate",
  deadline: "deadline",
  progress: "progress",
  createdAt: "createdAt",
};

async function listProjects(
  companyId,
  {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {},
) {
  try {
    if (!companyId) throw createError("Company ID is required", 400);

    page = Math.max(1, Number.parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    const offset = (page - 1) * limit;
    const sortField = PROJECT_SORT_FIELDS[sortBy] || "createdAt";
    const direction =
      String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";
    const normalizedSearch = String(search || "").trim();

    const where = { companyId };
    if (status) where.status = status;

    if (normalizedSearch) {
      const pattern = { [Op.iLike]: `%${normalizedSearch}%` };
      where[Op.or] = [
        { name: pattern },
        { description: pattern },
        { status: pattern },
        { tier: pattern },
        // These aliases must match the aliases in projectIncludes.
        { "$client.name$": pattern },
        { "$projectLead.fullName$": pattern },
      ];
    }

    const [
      count,
      summaryTotal,
      summaryActive,
      summaryCompleted,
      summaryOverdue,
    ] = await Promise.all([
      Project.count({
        where,
        include: projectIncludes,
        distinct: true,
        col: "id",
      }),
      Project.count({ where: { companyId } }),
      Project.count({
        where: {
          companyId,
          status: {
            [Op.in]: ["Planning", "In Development", "Testing", "On Hold"],
          },
        },
      }),
      Project.count({ where: { companyId, status: "Completed" } }),
      Project.count({
        where: {
          companyId,
          deadline: { [Op.lt]: new Date().toISOString().slice(0, 10) },
          status: { [Op.notIn]: ["Completed", "Cancelled"] },
        },
      }),
    ]);

    const totalPages = Math.ceil(count / limit);
    // If records were deleted while a user was on a later page, clamp the page.
    const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
    const safeOffset = (safePage - 1) * limit;

    const result = await Project.findAndCountAll({
      where,
      include: projectIncludes,
      distinct: true,
      limit,
      offset: safeOffset,
      order: [
        [sortField, direction],
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    logger.info("Projects fetched", {
      companyId,
      count: result.rows.length,
      total: count,
      page: safePage,
      limit,
    });

    return {
      projects: result.rows.map(formatProject),
      pagination: {
        page: safePage,
        limit,
        total: count,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
      // Global company totals, not affected by the current search/status/page.
      summary: {
        total: summaryTotal,
        active: summaryActive,
        completed: summaryCompleted,
        overdue: summaryOverdue,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch projects", {
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// --------------------------------------------------
// Get Single Project
// --------------------------------------------------

async function getProject(uuid, companyId) {
  try {
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
  } catch (error) {
    logger.error("Failed to fetch project", {
      companyId,
      uuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Create Project
// --------------------------------------------------

async function createProject(companyId, data) {
  try {
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

    logger.info("Project created", {
      companyId,
      uuid: project.uuid,
    });

    return getProject(project.uuid, companyId);
  } catch (error) {
    logger.error("Failed to create project", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Update Project
// --------------------------------------------------

async function updateProject(uuid, companyId, data) {
  try {
    if (!companyId) {
      throw createError("Company ID is required", 400);
    }

    if (!uuid) {
      throw createError("Project UUID is required", 400);
    }

    if (!data || typeof data !== "object") {
      throw createError("Project data is required", 400);
    }

    if (!data.name?.trim()) {
      throw createError("Project name is required", 400);
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

    const values = await prepareProjectData(companyId, data, project);

    await project.update(values);

    logger.info("Project updated", {
      companyId,
      uuid,
    });

    return getProject(uuid, companyId);
  } catch (error) {
    logger.error("Failed to update project", {
      companyId,
      uuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Delete Project
// --------------------------------------------------

async function deleteProject(uuid, companyId) {
  try {
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

    logger.info("Project deleted", {
      companyId,
      uuid,
    });

    return {
      message: "Project deleted successfully",
    };
  } catch (error) {
    logger.error("Failed to delete project", {
      companyId,
      uuid,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Exports
// --------------------------------------------------

module.exports = {
  getOptions,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
};
