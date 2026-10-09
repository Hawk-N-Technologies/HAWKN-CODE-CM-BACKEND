const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");

const Project = require("../models/Project");
const BRD = require("../models/BRD");
const Client = require("../models/Client");
const User = require("../models/User");
const Role = require("../models/Role");
const Employee = require("../models/Employee");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectOperationDeveloper = require("../models/ProjectOperationDeveloper");

const DIAGRAM_STATUSES = ["UPLOADED", "NOT_UPLOADED"];
const PLANNING_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];

const DEVELOPER_ROLES = ["developer"];
const TESTER_ROLES = ["tester", "qa", "quality assurance"];

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getRoleName(employee) {
  return (
    employee?.user?.role?.name ??
    employee?.user?.role?.roleName ??
    employee?.user?.role?.role_name ??
    ""
  );
}

function getEmployeeName(employee) {
  const user = employee?.user;

  return (
    user?.name ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    employee?.companyEmail ||
    user?.email ||
    `Employee ${employee?.id}`
  );
}

function employeeIncludes() {
  return [
    {
      model: User,
      as: "user",
      required: true,
      include: [
        {
          model: Role,
          as: "role",
          required: true,
        },
      ],
    },
  ];
}

function employeeToOption(employee) {
  return {
    id: employee.id,
    uuid: employee.uuid,
    name: getEmployeeName(employee),
    email: employee.user?.email || employee.companyEmail || null,
    role: getRoleName(employee),
  };
}

/**
 * Fetch projects whose BRDs have been approved by the client.
 * Existing operations assignments are included when present.
 */
async function getApprovedProjects(companyId) {
  const projects = await Project.findAll({
    where: { companyId },

    include: [
      {
        model: BRD,
        as: "brd",
        where: {
          companyId,
          status: "APPROVED",
        },
        required: true,
      },
      {
        model: Client,
        as: "client",
        required: false,
        include: [
          {
            model: User,
            as: "user",
            required: false,
          },
        ],
      },
      {
        model: ProjectOperation,
        as: "operationsPlan",
        required: false,
        include: [
          {
            model: Employee,
            as: "projectLead",
            required: false,
            include: employeeIncludes(),
          },
          {
            model: Employee,
            as: "tester",
            required: false,
            include: employeeIncludes(),
          },
          {
            model: Employee,
            as: "developers",
            required: false,
            through: { attributes: [] },
            include: employeeIncludes(),
          },
        ],
      },
    ],

    order: [["id", "DESC"]],
  });

  return projects;
}

/**
 * Fetch employee choices for the admin dropdowns.
 * Only active employees from the admin's company are considered.
 */
async function getOperationsOptions(companyId) {
  const employees = await Employee.findAll({
    where: {
      companyId,
      employmentStatus: "Active",
    },
    include: employeeIncludes(),
    order: [["id", "ASC"]],
  });

  const options = employees.map((employee) => ({
    employee,
    role: normalizeRole(getRoleName(employee)),
  }));

  const developers = options
    .filter(({ role }) => DEVELOPER_ROLES.includes(role))
    .map(({ employee }) => employeeToOption(employee));

  const testers = options
    .filter(({ role }) => TESTER_ROLES.includes(role))
    .map(({ employee }) => employeeToOption(employee));

  return {
    projectLeads: developers,
    developers,
    testers,
  };
}

/**
 * Create or update the operations plan for an approved project.
 */
async function saveOperationsPlan({
  brdUuid,
  companyId,
  userId,
  leadId,
  testerId,
  developerIds = [],
  technologyStack,
  erDiagramStatus = "NOT_UPLOADED",
  flowchartStatus = "NOT_UPLOADED",
}) {
  if (!brdUuid) {
    throw createError("BRD UUID is required.");
  }

  if (!Array.isArray(developerIds)) {
    throw createError("developerIds must be an array.");
  }

  if (!DIAGRAM_STATUSES.includes(erDiagramStatus)) {
    throw createError("Invalid ER diagram status.");
  }

  if (!DIAGRAM_STATUSES.includes(flowchartStatus)) {
    throw createError("Invalid flowchart status.");
  }

  const normalizedLeadId = leadId ? Number(leadId) : null;
  const normalizedTesterId = testerId ? Number(testerId) : null;

  const normalizedDeveloperIds = [
    ...new Set(
      developerIds
        .filter((id) => id !== null && id !== undefined && id !== "")
        .map(Number),
    ),
  ];

  const allIds = [
    ...new Set([
      ...(normalizedLeadId ? [normalizedLeadId] : []),
      ...(normalizedTesterId ? [normalizedTesterId] : []),
      ...normalizedDeveloperIds,
    ]),
  ];

  if (allIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw createError("One or more employee IDs are invalid.");
  }

  return sequelize.transaction(async (transaction) => {
    // Find the client-approved BRD using its UUID.
    const brd = await BRD.findOne({
      where: {
        uuid: brdUuid, // Change to your actual BRD UUID column name.
        companyId,
        status: "APPROVED",
      },
      transaction,
    });

    if (!brd) {
      throw createError(
        "BRD not found or it has not been approved by the client.",
        404,
      );
    }

    // Derive the project ID from the BRD.
    const projectId = brd.projectId;

    const project = await Project.findOne({
      where: {
        id: projectId,
        companyId,
      },
      transaction,
    });

    if (!project) {
      throw createError("Project not found in your company.", 404);
    }

    let employees = [];

    if (allIds.length > 0) {
      employees = await Employee.findAll({
        where: {
          id: { [Op.in]: allIds },
          companyId,
          employmentStatus: "Active",
        },
        include: employeeIncludes(),
        transaction,
      });

      if (employees.length !== allIds.length) {
        throw createError(
          "One or more employees are inactive, unavailable, or belong to another company.",
        );
      }
    }

    const employeeById = new Map(
      employees.map((employee) => [Number(employee.id), employee]),
    );

    if (normalizedLeadId) {
      const lead = employeeById.get(normalizedLeadId);
      const role = normalizeRole(getRoleName(lead));

      if (!DEVELOPER_ROLES.includes(role)) {
        throw createError("The project lead must have the developer role.");
      }
    }

    if (normalizedTesterId) {
      const tester = employeeById.get(normalizedTesterId);
      const role = normalizeRole(getRoleName(tester));

      if (!TESTER_ROLES.includes(role)) {
        throw createError("The assigned tester must have a tester/QA role.");
      }
    }

    for (const id of normalizedDeveloperIds) {
      const employee = employeeById.get(id);
      const role = normalizeRole(getRoleName(employee));

      if (!DEVELOPER_ROLES.includes(role)) {
        throw createError(
          "Every assigned developer must have the developer role.",
        );
      }
    }

    const hasPlanningDetails = Boolean(
      normalizedLeadId &&
      normalizedTesterId &&
      normalizedDeveloperIds.length > 0 &&
      String(technologyStack || "").trim(),
    );

    const planningComplete = Boolean(
      hasPlanningDetails &&
      erDiagramStatus === "UPLOADED" &&
      flowchartStatus === "UPLOADED",
    );

    const planningStatus = planningComplete
      ? "COMPLETED"
      : hasPlanningDetails
        ? "IN_PROGRESS"
        : "NOT_STARTED";

    const planValues = {
      companyId,
      projectLeadId: normalizedLeadId,
      testerId: normalizedTesterId,
      technologyStack: technologyStack ? String(technologyStack).trim() : null,
      erDiagramStatus,
      flowchartStatus,
      planningStatus,
      updatedBy: userId || null,
    };

    let plan = await ProjectOperation.findOne({
      where: { projectId, companyId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (plan) {
      await plan.update(planValues, { transaction });
    } else {
      plan = await ProjectOperation.create(
        {
          projectId,
          ...planValues,
          createdBy: userId || null,
        },
        { transaction },
      );
    }

    // Replace existing developer assignments.
    await ProjectOperationDeveloper.destroy({
      where: { projectOperationId: plan.id },
      transaction,
    });

    if (normalizedDeveloperIds.length > 0) {
      await ProjectOperationDeveloper.bulkCreate(
        normalizedDeveloperIds.map((employeeId) => ({
          projectOperationId: plan.id,
          employeeId,
        })),
        { transaction },
      );
    }

    return ProjectOperation.findByPk(plan.id, {
      transaction,
      include: [
        {
          model: Employee,
          as: "projectLead",
          required: false,
          include: employeeIncludes(),
        },
        {
          model: Employee,
          as: "tester",
          required: false,
          include: employeeIncludes(),
        },
        {
          model: Employee,
          as: "developers",
          required: false,
          through: { attributes: [] },
          include: employeeIncludes(),
        },
      ],
    });
  });
}

async function getMyProjects(userId, companyId) {
  if (!userId || !companyId) {
    const error = new Error("Authenticated user and company are required.");
    error.statusCode = 401;
    throw error;
  }

  // 1. Resolve the logged-in user's Employee record.
  const employee = await Employee.findOne({
    where: {
      userId,
      companyId,
    },
  });

  if (!employee) {
    const error = new Error("No employee record found for this user.");
    error.statusCode = 404;
    throw error;
  }

  // 2. Find operations plans where this employee is assigned as a developer.
  const developerAssignments = await ProjectOperationDeveloper.findAll({
    where: {
      employeeId: employee.id,
    },
    attributes: ["projectOperationId"],
    raw: true,
  });

  const developerPlanIds = [
    ...new Set(
      developerAssignments
        .map((assignment) => assignment.projectOperationId)
        .filter(Boolean)
        .map(Number),
    ),
  ];

  // 3. Find plans where the employee is either the lead or a developer.
  const assignmentConditions = [{ projectLeadId: employee.id }];

  if (developerPlanIds.length > 0) {
    assignmentConditions.push({
      id: { [Op.in]: developerPlanIds },
    });
  }

  const operationPlans = await ProjectOperation.findAll({
    where: {
      companyId,
      [Op.or]: assignmentConditions,
    },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        include: [
          {
            model: Client,
            as: "client",
            required: false,
            include: [
              {
                model: User,
                as: "user",
                required: false,
              },
            ],
          },
        ],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  // 4. Convert operation plans to the response shape used by MyProjects.jsx.
  const uniqueProjects = new Map();

  for (const plan of operationPlans) {
    const project = plan.project;

    if (!project) continue;

    const client = project.client;
    const clientUser = client?.user;

    const clientName =
      clientUser?.name ||
      [clientUser?.firstName, clientUser?.lastName].filter(Boolean).join(" ") ||
      client?.name ||
      "Client";

    const deadline = project.deadline || null;
    const daysLeft = getDaysLeft(deadline);

    uniqueProjects.set(String(project.id), {
      id: project.id,
      uuid: project.uuid,
      name: project.name,
      description: project.description || "",
      tier: project.tier || "",
      status: project.status || "Planning",
      startDate: project.startDate || null,
      deadline,
      internalDeadline: project.internalDeadline || null,
      progress: Number(project.progress || 0),

      client: {
        name: clientName,
        email: client?.email || clientUser?.email || "",
        phone: client?.phone || clientUser?.phone || "",
      },

      isOverdue: daysLeft !== null && daysLeft < 0,
      isDueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= 7,
      daysLeft,

      // Optional metadata if you need it elsewhere in the UI.
      operationsPlanId: plan.id,
      assignmentRole:
        String(plan.projectLeadId) === String(employee.id)
          ? "Project Lead"
          : "Developer",
    });
  }

  return [...uniqueProjects.values()];
}

// Compare calendar days without time-of-day or UTC time shifts.
function getDaysLeft(dateValue) {
  if (!dateValue) return null;

  const dateString = String(dateValue).slice(0, 10);
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return null;

  const deadlineUtc = Date.UTC(year, month - 1, day);
  const now = new Date();

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((deadlineUtc - todayUtc) / 86_400_000);
}

module.exports = {
  getApprovedProjects,
  getOperationsOptions,
  saveOperationsPlan,
  getMyProjects,
};
