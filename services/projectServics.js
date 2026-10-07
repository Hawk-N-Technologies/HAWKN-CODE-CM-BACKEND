const { Op } = require("@sequelize/core");

const Project = require("../models/Project");
const Client = require("../models/Client");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Role = require("../models/Role");

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

const daysBetween = (from, to) => {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );
};

// --------------------------------------------------
// Project response
// --------------------------------------------------

const formatProject = (project) => {
  const today = getToday();

  const deadline = dateOnly(project.deadline);

  const isOpen = !CLOSED_STATUSES.includes(project.status);

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

    canDelete: DELETABLE_STATUSES.includes(project.status),

    client: project.client
      ? {
          uuid: project.client.uuid,
          name: project.client.user
            ? fullName(
                project.client.user.firstName || project.client.user.first_name,
                project.client.user.lastName || project.client.user.last_name,
              )
            : null,
          contactPerson: project.client.user
            ? fullName(
                project.client.user.firstName || project.client.user.first_name,
                project.client.user.lastName || project.client.user.last_name,
              )
            : null,
          email: project.client.user?.email || null,
        }
      : null,

    projectLead: project.projectLead
      ? {
          uuid: project.projectLead.uuid,
          fullName: project.projectLead.user
            ? fullName(
                project.projectLead.user.firstName ||
                  project.projectLead.user.first_name,
                project.projectLead.user.lastName ||
                  project.projectLead.user.last_name,
              )
            : null,
          email: project.projectLead.user?.email || null,
        }
      : null,
  };
};

// --------------------------------------------------
// Validate + prepare project data
// --------------------------------------------------

const prepareProjectData = async (companyId, data, currentProject = null) => {
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

  // During update, current client is still allowed
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
          where: {
            isActive: true,
          },

          include: [
            {
              model: Role,
              as: "role",
              where: {
                name: "project_lead",
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

// --------------------------------------------------
// Get project options
// --------------------------------------------------

const getProjectOptions = async (companyId) => {
  if (!companyId) {
    throw createError("Company ID is required", 400);
  }

  const clients = await Client.findAll({
    where: {
      companyId,
      isActive: true,
    },

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

    order: [["id", "ASC"]],
  });

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

            where: {
              name: "project_lead",
            },

            attributes: ["id", "name"],
          },
        ],
      },
    ],
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
