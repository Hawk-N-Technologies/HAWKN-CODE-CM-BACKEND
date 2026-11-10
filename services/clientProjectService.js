const { Op } = require("@sequelize/core");

const {
  Project,
  Client,
  Employee,
  User,
  BRD,
  BRDVersion,
} = require("../models/associations");

const logger = require("../utils/logger");

// --------------------------------------------------
// Constants
// --------------------------------------------------

const MAX_LIMIT = 100;
const MAX_DASHBOARD_ROWS = 200;
const DUE_SOON_DAYS = 14;
const CLOSED_STATUSES = ["Completed", "Cancelled"];

const SORT_FIELDS = {
  name: "name",
  status: "status",
  tier: "tier",
  projectType: "projectType",
  progress: "progress",
  startDate: "startDate",
  deadline: "deadline",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const todayIST = () =>
  new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

const daysBetween = (from, to) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  );

const fullName = (user) =>
  [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
    .filter(Boolean)
    .join(" ");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// --------------------------------------------------
// Get Logged-in Client
// --------------------------------------------------

async function getClient(userId, companyId) {
  if (!userId || !companyId) {
    throw createError("User ID and Company ID are required", 400);
  }

  const client = await Client.findOne({
    where: {
      userId,
      companyId,
      isActive: true,
    },
    attributes: ["id"],
  });

  return client;
}

// --------------------------------------------------
// Project Associations
// --------------------------------------------------
const projectIncludes = [
  {
    model: Employee,
    as: "projectLead",
    required: false,
    attributes: ["uuid"],
    include: [
      {
        model: User,
        as: "user",
        required: false,
      },
    ],
  },
  {
    model: BRD,
    as: "brd",
    required: false,
    attributes: [
      "id", // IMPORTANT: Required for BRDVersion association
      "uuid",
      "title",
      "description",
      "status",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: BRDVersion,
        as: "versions",
        required: false,
        separate: true,
        order: [["version", "DESC"]],
        attributes: [
          "uuid", // Required for the file-view endpoint
          "version",
          "fileName",
          "mimeType",
          "fileSize",
          "createdAt",
        ],
      },
    ],
  },
];

// --------------------------------------------------
// Format Project Response
// --------------------------------------------------

function formatProject(project) {
  const deadline = dateOnly(project.deadline);

  const isOpen = !CLOSED_STATUSES.includes(project.status);

  const daysLeft =
    isOpen && deadline ? daysBetween(todayIST(), deadline) : null;

  const brd = project.brd;

  return {
    uuid: project.uuid,
    name: project.name,

    tier: project.tier,
    projectType: project.projectType,
    status: project.status,
    progress: Number(project.progress),

    description: project.description,

    startDate: dateOnly(project.startDate),
    deadline,

    githubRepos: project.githubRepos || null,
    serverUrl: project.serverUrl || null,

    createdAt: project.createdAt,
    updatedAt: project.updatedAt,

    daysLeft,
    isOverdue: daysLeft !== null && daysLeft < 0,
    isDueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,

    projectLead: project.projectLead
      ? {
          fullName: fullName(project.projectLead.user) || null,
        }
      : null,

    brd: brd
      ? {
          uuid: brd.uuid,
          title: brd.title,
          description: brd.description,
          status: brd.status,
          createdAt: brd.createdAt,
          updatedAt: brd.updatedAt,

          versions: (brd.versions || []).map((version) => ({
            uuid: version.uuid,
            version: version.version,
            fileName: version.fileName,
            mimeType: version.mimeType,
            fileSize: version.fileSize,
            uploadedAt: version.createdAt,
            viewUrl: `/api/brds/versions/${version.uuid}/file`,
          })),
        }
      : null,
  };
}

// --------------------------------------------------
// Build Client Project Summary
// --------------------------------------------------

function buildSummary(projects) {
  return {
    total: projects.length,

    active: projects.filter(
      (project) => !CLOSED_STATUSES.includes(project.status),
    ).length,

    completed: projects.filter((project) => project.status === "Completed")
      .length,

    overdue: projects.filter(
      (project) =>
        !CLOSED_STATUSES.includes(project.status) &&
        project.deadline &&
        daysBetween(todayIST(), dateOnly(project.deadline)) < 0,
    ).length,
  };
}

// --------------------------------------------------
// Client Dashboard
// --------------------------------------------------

async function getDashboardProjects(userId, companyId) {
  try {
    const client = await getClient(userId, companyId);

    if (!client) {
      return {
        summary: {
          total: 0,
          active: 0,
          completed: 0,
          overdue: 0,
        },
        projects: [],
      };
    }

    const projects = await Project.findAll({
      where: {
        companyId,
        clientId: client.id,
      },

      attributes: [
        "uuid",
        "name",
        "tier",
        "projectType",
        "status",
        "progress",
        "description",
        "startDate",
        "deadline",
        "githubRepos",
        "serverUrl",
        "createdAt",
        "updatedAt",
      ],

      include: projectIncludes,

      order: [
        ["deadline", "ASC"],
        ["createdAt", "DESC"],
      ],

      limit: MAX_DASHBOARD_ROWS,
    });

    const rows = projects
      .map(formatProject)
      .sort(
        (a, b) =>
          Number(CLOSED_STATUSES.includes(a.status)) -
          Number(CLOSED_STATUSES.includes(b.status)),
      );

    logger.info("Client dashboard projects fetched", {
      userId,
      companyId,
      clientId: client.id,
      count: rows.length,
    });

    return {
      summary: buildSummary(rows),
      projects: rows,
    };
  } catch (error) {
    logger.error("Failed to fetch client dashboard projects", {
      userId,
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

// --------------------------------------------------
// Client: List Projects (Pagination + Filters)
// --------------------------------------------------

async function listProjects(
  userId,
  companyId,
  {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    tier = "",
    projectType = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = {},
) {
  try {
    const client = await getClient(userId, companyId);

    if (!client) {
      return {
        projects: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        summary: {
          total: 0,
          active: 0,
          completed: 0,
          overdue: 0,
        },
      };
    }

    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);

    const pageLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.parseInt(limit, 10) || 10),
    );

    const normalizedSearch = String(search || "").trim();

    const sortField = SORT_FIELDS[sortBy] || "createdAt";

    const direction =
      String(sortOrder).toLowerCase() === "asc" ? "ASC" : "DESC";

    // Critical: only this client's projects.
    const where = {
      companyId,
      clientId: client.id,
    };

    if (status) where.status = status;
    if (tier) where.tier = tier;
    if (projectType) where.projectType = projectType;

    if (normalizedSearch) {
      const pattern = {
        [Op.iLike]: `%${normalizedSearch}%`,
      };

      where[Op.or] = [
        { name: pattern },
        { description: pattern },
        { status: pattern },
        { tier: pattern },
        { projectType: pattern },
      ];
    }

    const result = await Project.findAndCountAll({
      where,
      include: projectIncludes,

      distinct: true,
      col: "id",

      limit: pageLimit,
      offset: (currentPage - 1) * pageLimit,

      order: [
        [sortField, direction],
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
    });

    // Summary is scoped to this client, not the entire company.
    const [summaryTotal, summaryActive, summaryCompleted, summaryOverdue] =
      await Promise.all([
        Project.count({
          where: {
            companyId,
            clientId: client.id,
          },
        }),

        Project.count({
          where: {
            companyId,
            clientId: client.id,
            status: {
              [Op.notIn]: CLOSED_STATUSES,
            },
          },
        }),

        Project.count({
          where: {
            companyId,
            clientId: client.id,
            status: "Completed",
          },
        }),

        Project.count({
          where: {
            companyId,
            clientId: client.id,
            deadline: {
              [Op.lt]: todayIST(),
            },
            status: {
              [Op.notIn]: CLOSED_STATUSES,
            },
          },
        }),
      ]);

    const total = result.count;
    const totalPages = Math.ceil(total / pageLimit);

    logger.info("Client projects fetched", {
      userId,
      companyId,
      clientId: client.id,
      total,
      page: currentPage,
      limit: pageLimit,
    });

    return {
      projects: result.rows.map(formatProject),

      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },

      summary: {
        total: summaryTotal,
        active: summaryActive,
        completed: summaryCompleted,
        overdue: summaryOverdue,
      },
    };
  } catch (error) {
    logger.error("Failed to fetch client projects", {
      userId,
      companyId,
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
  getDashboardProjects,
  listProjects,
};
