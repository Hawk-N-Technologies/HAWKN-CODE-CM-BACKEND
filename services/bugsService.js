"use strict";

const Employee = require("../models/Employee");
const Project = require("../models/Project");
const ProjectBug = require("../models/ProjectBug");
const Role = require("../models/Role");
const User = require("../models/User");
const BugTesting = require("../models/BugTesting");
const sequelize = require("../config/db");
const SEVERITIES = ["Low", "Medium", "High", "Critical"];
const { Op } = require("@sequelize/core");

const { QueryTypes } = require("@sequelize/core");
const IssueReport = require("../models/IssueReport");
const ProjectOperationTester = require("../models/ProjectOperationTester");
const ProjectOperationDeveloper = require("../models/ProjectOperationDeveloper");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectModule = require("../models/ProjectModule");
const Client = require("../models/Client");
const logger = require("../utils/logger");
const {
  refWhere,
  findCompanyProject,
  findActiveEmployee,
  isLeadOfProject,
  isClientOfProject,
} = require("../middleware/projectAccess");
// Safety cap for lists that keep growing (until they get real pagination)
const MAX_LIST_ROWS = 1000;

const STATUSES = [
  "Open",
  "Assigned",
  "In Progress",
  "Fixed",
  "Ready for Retest",
  "Reopened",
  "Closed",
  "Rejected",
];

const DISCOVERY_SOURCES = [
  "Client",
  "Testing",
  "Development",
  "Code Review",
  "Production",
  "Retesting",
];

class BugServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "BugServiceError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Access helpers — every lookup stays inside the user's company
// ---------------------------------------------------------------------------

// Project of the user's company (UUID or numeric id), or 404
async function getCompanyProject(ref, companyId, transaction) {
  if (ref === undefined || ref === null || ref === "") {
    throw new BugServiceError("Project ID is required.", 400);
  }

  const project = await findCompanyProject(ref, companyId, transaction);

  if (!project) {
    throw new BugServiceError("Project not found.", 404);
  }

  return project;
}

// Module of THIS project (UUID or numeric id). Empty → null.
async function getProjectModule(ref, projectId, transaction) {
  if (ref === undefined || ref === null || ref === "") return null;

  const where = refWhere(ref);

  const module = where
    ? await ProjectModule.findOne({
        where: { ...where, projectId },
        attributes: ["id", "uuid", "name"],
        transaction,
      })
    : null;

  if (!module) {
    throw new BugServiceError("Module does not belong to this project.", 400);
  }

  return module;
}

// Assignee must be an active employee of the same company. Empty → null.
async function getCompanyAssignee(employeeId, companyId, transaction) {
  if (employeeId === undefined || employeeId === null || employeeId === "") {
    return null;
  }

  const employee = await Employee.findOne({
    where: {
      id: Number(employeeId),
      companyId,
      employmentStatus: "Active",
    },
    attributes: ["id"],
    transaction,
  });

  if (!employee) {
    throw new BugServiceError("Assigned developer not found.", 400);
  }

  return employee.id;
}

// Project ids a tester is assigned to (team testers + operations tester)
async function getTesterProjectIds(employeeId, companyId) {
  const links = await ProjectOperationTester.findAll({
    where: { employeeId },
    attributes: ["projectOperationId"],
    raw: true,
  });

  const operations = await ProjectOperation.findAll({
    where: {
      companyId,
      [Op.or]: [
        { id: { [Op.in]: links.map((link) => link.projectOperationId) } },
        { testerId: employeeId },
      ],
    },
    attributes: ["projectId"],
    raw: true,
  });

  return [...new Set(operations.map((operation) => operation.projectId))];
}

async function isTesterOfProject(userId, companyId, projectId) {
  const employee = await findActiveEmployee(userId, companyId);
  if (!employee) return false;

  const projectIds = await getTesterProjectIds(employee.id, companyId);
  return projectIds.some((id) => Number(id) === Number(projectId));
}

async function assertTesterOfProject(user, projectId) {
  const allowed = await isTesterOfProject(
    user.userId,
    user.companyId,
    projectId,
  );

  if (!allowed) {
    throw new BugServiceError("You are not assigned to test this project.", 403);
  }
}

// Who may report a bug on a project
async function assertCanReport(user, project) {
  if (user.role === "client") {
    const owns = await isClientOfProject(user.userId, user.companyId, project);
    if (!owns) throw new BugServiceError("Project not found.", 404);
    return;
  }

  if (user.role === "tester") {
    await assertTesterOfProject(user, project.id);
    return;
  }

  if (user.role === "developer") {
    const isLead = await isLeadOfProject(user.userId, user.companyId, project);
    if (!isLead) {
      throw new BugServiceError(
        "Only the lead of this project can do this.",
        403,
      );
    }
    return;
  }

  throw new BugServiceError("You are not allowed to report bugs.", 403);
}

// ---------------------------------------------------------------------------
// Team helpers — the project's team lives on its operations plan
// ---------------------------------------------------------------------------

// Developer employee ids on THIS project's team
async function getTeamDeveloperIds(projectId, companyId, transaction) {
  const operations = await ProjectOperation.findAll({
    where: { projectId, companyId },
    attributes: ["id"],
    raw: true,
    transaction,
  });

  if (!operations.length) return [];

  const links = await ProjectOperationDeveloper.findAll({
    where: {
      projectOperationId: { [Op.in]: operations.map((item) => item.id) },
    },
    attributes: ["employeeId"],
    raw: true,
    transaction,
  });

  return [...new Set(links.map((link) => Number(link.employeeId)))];
}

/**
 * A bug can only be assigned to an active developer of the same company who
 * is on THIS project's team (the developers under its lead). Empty → null.
 */
async function getTeamAssignee(employeeId, project, companyId, transaction) {
  if (employeeId === undefined || employeeId === null || employeeId === "") {
    return null;
  }

  const id = await getCompanyAssignee(employeeId, companyId, transaction);
  const teamIds = await getTeamDeveloperIds(project.id, companyId, transaction);

  if (!teamIds.includes(Number(id))) {
    throw new BugServiceError(
      "Assign a developer from this project's team.",
      400,
    );
  }

  const developer = await Employee.findOne({
    where: { id, companyId },
    attributes: ["id"],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id"],
        required: true,
        where: { isActive: true },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["name"],
            required: true,
            where: { name: "developer" },
          },
        ],
      },
    ],
    transaction,
  });

  if (!developer) {
    throw new BugServiceError("Assign a developer from this project's team.", 400);
  }

  return id;
}

// Next retest attempt number for a bug (1, 2, 3 …)
async function nextAttemptNumber(bugId, transaction) {
  const last = await BugTesting.max("attemptNumber", {
    where: { bugId },
    transaction,
  });

  return (Number(last) || 0) + 1;
}

// ---------------------------------------------------------------------------
// Bugs
// ---------------------------------------------------------------------------

/**
 * Report a bug.
 *  - client    → a ticket for the tester to review (IssueReport)
 *  - tester    → a real bug, Open + unassigned, so it goes to the project lead
 *  - developer → (project lead) a real bug, optionally assigned to a developer
 *                on this project's team
 */
async function createBug(user, data) {
  const {
    projectId,
    moduleId,
    title,
    description,
    severity,
    discoverySource,
    assignedTo,
  } = data;

  const project = await getCompanyProject(projectId, user.companyId);
  await assertCanReport(user, project);

  const module = await getProjectModule(moduleId, project.id);

  if (user.role === "client") {
    return IssueReport.create({
      projectId: project.id,
      moduleId: module?.id ?? null,
      title: title.trim(),
      description: description?.trim() || null,
      severity: severity || "Medium",
      reportedBy: user.userId,
      status: "Submitted",
      classification: "Bug",
    });
  }

  if (user.role === "tester") {
    return ProjectBug.create({
      projectId: project.id,
      moduleId: module?.id ?? null,
      title: title.trim(),
      description: description?.trim() || null,
      severity: severity || "Medium",
      discoverySource: "Testing",
      status: "Open",
      assignedTo: null,
    });
  }

  // Project lead
  const assigneeId = await getTeamAssignee(assignedTo, project, user.companyId);

  return ProjectBug.create({
    projectId: project.id,
    moduleId: module?.id ?? null,
    title: title.trim(),
    description: description?.trim() || null,
    severity: severity || "Medium",
    discoverySource: discoverySource || "Development",
    status: assigneeId ? "Assigned" : "Open",
    assignedTo: assigneeId,
  });
}

async function getProjectBugs(projectId, filters = {}, companyId) {
  const { status, severity, moduleId } = filters;

  const project = await getCompanyProject(projectId, companyId);

  const where = {
    projectId: project.id,
  };

  if (status) {
    where.status = status;
  }

  if (severity) {
    where.severity = severity;
  }

  if (moduleId) {
    const module = await getProjectModule(moduleId, project.id);
    where.moduleId = module.id;
  }

  return ProjectBug.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: MAX_LIST_ROWS,
  });
}

// Developers on the teams of the projects this lead leads (same company)
async function getDevs(companyId, userId) {
  const employee = await findActiveEmployee(userId, companyId);

  if (!employee) return [];

  const [ledProjects, ledOperations] = await Promise.all([
    Project.findAll({
      where: { companyId, projectLeadId: employee.id },
      attributes: ["id"],
      raw: true,
    }),
    ProjectOperation.findAll({
      where: { companyId, projectLeadId: employee.id },
      attributes: ["projectId"],
      raw: true,
    }),
  ]);

  const projectIds = [
    ...new Set([
      ...ledProjects.map((project) => project.id),
      ...ledOperations.map((operation) => operation.projectId),
    ]),
  ];

  const teamIds = new Set();
  for (const projectId of projectIds) {
    for (const id of await getTeamDeveloperIds(projectId, companyId)) {
      teamIds.add(id);
    }
  }

  if (!teamIds.size) return [];

  return Employee.findAll({
    attributes: ["id", "uuid", "userId"],
    where: {
      id: { [Op.in]: [...teamIds] },
      companyId,
      employmentStatus: "Active",
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstName", "lastName"],
        required: true,
        where: {
          companyId,
          isActive: true,
        },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["id", "name"],
            where: {
              name: "developer",
              isActive: true,
            },
            required: true,
          },
        ],
      },
    ],
    order: [["id", "ASC"]],
  });
}

async function updateBug(bugId, projectId, data, companyId) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const project = await getCompanyProject(projectId, companyId, transaction);

    const bug = await ProjectBug.findOne({
      where: {
        uuid: bugId,
        projectId: project.id,
      },
      transaction,
    });

    if (!bug) {
      throw new BugServiceError("Bug not found in this project.", 404);
    }

    const updates = {};

    if (data.title !== undefined) {
      updates.title = data.title.trim();
    }

    if (data.description !== undefined) {
      updates.description = data.description?.trim() || null;
    }

    if (data.severity !== undefined) {
      updates.severity = data.severity;
    }

    if (data.discoverySource !== undefined) {
      updates.discoverySource = data.discoverySource;
    }

    if (data.status !== undefined) {
      updates.status = data.status;
    }

    if (data.moduleId !== undefined) {
      const module = await getProjectModule(
        data.moduleId,
        project.id,
        transaction,
      );
      updates.moduleId = module?.id ?? null;
    }

    if (data.assignedTo !== undefined) {
      updates.assignedTo = await getTeamAssignee(
        data.assignedTo,
        project,
        companyId,
        transaction,
      );

      if (
        updates.assignedTo &&
        data.status === undefined &&
        bug.status === "Open"
      ) {
        updates.status = "Assigned";
      }
    }

    const nextStatus = updates.status ?? bug.status;

    // Create a testing record when the bug is moved to Ready for Retest.
    if (
      nextStatus === "Ready for Retest" &&
      bug.status !== "Ready for Retest"
    ) {
      await BugTesting.create(
        {
          projectId: project.id,
          bugId: bug.id,
          attemptNumber: await nextAttemptNumber(bug.id, transaction),
          status: "Pending",
        },
        { transaction },
      );
    }

    await bug.update(updates, { transaction });

    await transaction.commit();

    return bug;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

// Bugs assigned to the logged-in developer in one project
async function getAssignedBugs(userId, projectId, companyId) {
  const employee = await findActiveEmployee(userId, companyId);

  if (!employee) return [];

  const project = await getCompanyProject(projectId, companyId);

  return ProjectBug.findAll({
    where: {
      assignedTo: employee.id,
      projectId: project.id,
    },
    order: [["createdAt", "DESC"]],
    limit: MAX_LIST_ROWS,
  });
}

/**
 * Projects for the bug pages:
 *  - tester    → projects they are assigned to test
 *  - developer → projects they lead, are on the team of, or have bugs in
 */
async function projectsDropdown(user) {
  const { userId, companyId, role } = user;
  const employee = await findActiveEmployee(userId, companyId);

  if (!employee) return [];

  let projectIds = [];

  if (role === "tester") {
    projectIds = await getTesterProjectIds(employee.id, companyId);
  } else {
    const [ledProjects, ledOperations, teamLinks, assignedBugs] =
      await Promise.all([
        Project.findAll({
          where: { companyId, projectLeadId: employee.id },
          attributes: ["id"],
          raw: true,
        }),
        ProjectOperation.findAll({
          where: { companyId, projectLeadId: employee.id },
          attributes: ["projectId"],
          raw: true,
        }),
        ProjectOperationDeveloper.findAll({
          where: { employeeId: employee.id },
          attributes: ["projectOperationId"],
          raw: true,
        }),
        ProjectBug.findAll({
          where: { assignedTo: employee.id },
          attributes: ["projectId"],
          raw: true,
        }),
      ]);

    const teamOperations = teamLinks.length
      ? await ProjectOperation.findAll({
          where: {
            companyId,
            id: { [Op.in]: teamLinks.map((link) => link.projectOperationId) },
          },
          attributes: ["projectId"],
          raw: true,
        })
      : [];

    projectIds = [
      ...ledProjects.map((project) => project.id),
      ...ledOperations.map((operation) => operation.projectId),
      ...teamOperations.map((operation) => operation.projectId),
      ...assignedBugs.map((bug) => bug.projectId),
    ];
  }

  const uniqueIds = [...new Set(projectIds.filter(Boolean))];

  if (!uniqueIds.length) return [];

  // companyId here also filters out bugs/links pointing elsewhere
  return Project.findAll({
    where: { companyId, id: { [Op.in]: uniqueIds } },
    attributes: ["id", "uuid", "name"],
    order: [["name", "ASC"]],
  });
}

const ALLOWED_STATUSES = ["Fixed", "In Progress", "Assigned"];

// Developer updates the status of a bug ASSIGNED TO THEM
async function updateStatusDEV(uuid, status, user) {
  if (!uuid || typeof uuid !== "string") {
    throw new BugServiceError("Valid bug UUID is required.", 400);
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new BugServiceError(
      `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}.`,
      400,
    );
  }

  const employee = await findActiveEmployee(user.userId, user.companyId);

  if (!employee) {
    throw new BugServiceError("Bug not found.", 404);
  }

  const bug = await ProjectBug.findOne({
    where: { uuid, assignedTo: employee.id },
    include: [
      {
        model: Project,
        as: "project",
        attributes: ["id"],
        where: { companyId: user.companyId },
        required: true,
      },
    ],
  });

  if (!bug) {
    throw new BugServiceError("Bug not found or not assigned to you.", 404);
  }

  // The developer can only move a bug while it is with them.
  // Ready for Retest / Closed / Rejected / Open / Reopened belong to the
  // project lead or the tester.
  const DEVELOPER_STAGES = ["Assigned", "In Progress", "Fixed"];

  if (!DEVELOPER_STAGES.includes(bug.status)) {
    throw new BugServiceError(
      `This bug is "${bug.status}" and can't be changed by the developer right now.`,
      409,
    );
  }

  await bug.update({ status });

  return bug;
}

async function getReportedIssues(userId) {
  // reportedBy = the logged-in user → only their own issues
  return IssueReport.findAll({
    where: {
      reportedBy: userId,
    },
    order: [["createdAt", "DESC"]],
    limit: MAX_LIST_ROWS,
  });
}

async function getIssuesForTester(userId, companyId) {
  try {
    const employee = await Employee.findOne({
      where: { userId, companyId },
      attributes: ["id"],
      raw: true,
    });

    if (!employee) return [];

    const issues = await sequelize.query(
      `
      SELECT
        ir.*,
        p.name AS "projectName",
        pm.name AS "moduleName"

      FROM issue_reports ir

      INNER JOIN project_operation_testers pot
        ON pot.employee_id = :employee_id

      INNER JOIN project_operations po
        ON po.id = pot.project_operation_id
        AND po.project_id = ir.project_id
        AND po.company_id = :company_id

      INNER JOIN projects p
        ON p.id = ir.project_id
        AND p.company_id = :company_id

      LEFT JOIN project_modules pm
        ON pm.id = ir.module_id
        AND pm.project_id = ir.project_id

      ORDER BY ir.created_at DESC
      LIMIT :max_rows
      `,
      {
        replacements: {
          employee_id: employee.id,
          company_id: companyId,
          max_rows: MAX_LIST_ROWS,
        },
        type: QueryTypes.SELECT,
      },
    );

    return issues;
  } catch (error) {
    logger.error("Error fetching issues for tester", { error: error?.message, stack: error?.stack });
    throw error;
  }
}

// Tester reviews an issue of a project they are assigned to
async function updateStatus(uuid, status, classification, user) {
  const issue = await IssueReport.findOne({
    where: {
      uuid,
    },
  });

  if (!issue) {
    throw new BugServiceError("Issue report not found.", 404);
  }

  const project = await findCompanyProject(issue.projectId, user.companyId);

  if (!project) {
    throw new BugServiceError("Issue report not found.", 404);
  }

  await assertTesterOfProject(user, project.id);

  const ISSUE_STATUSES = [
    "Submitted",
    "Under Review",
    "Confirmed",
    "Feature Request",
    "Rejected",
    "Solved",
  ];

  const CLASSIFICATIONS = [
    "Bug",
    "Feature Request",
    "Issue",
    "Change Request",
  ];

  if (!ISSUE_STATUSES.includes(status)) {
    throw new BugServiceError("Invalid issue status.", 400);
  }

  if (classification != null && !CLASSIFICATIONS.includes(classification)) {
    throw new BugServiceError("Invalid issue classification.", 400);
  }

  await issue.update({
    status,
    classification,
  });

  return issue;
}

function validateTesterBug({ title, status, severity, discoverySource }) {
  if (!title || !title.trim()) {
    throw new BugServiceError("Bug title is required.", 400);
  }

  if (!STATUSES.includes(status)) {
    throw new BugServiceError("Invalid bug status.", 400);
  }

  if (!SEVERITIES.includes(severity)) {
    throw new BugServiceError("Invalid bug severity.", 400);
  }

  if (!DISCOVERY_SOURCES.includes(discoverySource)) {
    throw new BugServiceError("Invalid discovery source.", 400);
  }
}

// Tester creates a bug in a project they are assigned to.
// It is always saved Open + unassigned, so it goes to the project lead —
// testers never assign developers.
async function createBugByTester(data, user) {
  const {
    projectId,
    moduleId,
    severity = "Medium",
    title,
    description,
    discoverySource = "Testing",
  } = data;

  const project = await getCompanyProject(projectId, user.companyId);
  await assertTesterOfProject(user, project.id);

  const module = await getProjectModule(moduleId, project.id);

  validateTesterBug({ title, status: "Open", severity, discoverySource });

  return ProjectBug.create({
    projectId: project.id,
    moduleId: module?.id ?? null,
    severity,
    title: title.trim(),
    description: description?.trim() || null,
    status: "Open",
    discoverySource,
    assignedTo: null,
  });
}

// Bugs of every project the tester is assigned to
async function getBugsInTester(userId, companyId) {
  const employee = await findActiveEmployee(userId, companyId);

  if (!employee) {
    return [];
  }

  const projectIds = await getTesterProjectIds(employee.id, companyId);

  if (!projectIds.length) {
    return [];
  }

  return ProjectBug.findAll({
    where: {
      projectId: {
        [Op.in]: projectIds,
      },
    },
    order: [["createdAt", "DESC"]],
    limit: MAX_LIST_ROWS,
    include: [
      {
        model: Project,
        as: "project",
        attributes: ["uuid", "name"],
      },
      {
        model: ProjectModule,
        as: "module",
        attributes: ["uuid", "name"],
        required: false,
      },
    ],
  });
}

/**
 * What a tester may do to a bug's status:
 *  - keep the current status (edit details only)
 *  - Ready for Retest → Closed (fix passed) | Reopened (fix failed)
 *  - Open (not yet with a developer) → Rejected (withdrawn)
 * Reopened clears the assignee so the bug goes back to the project lead.
 */
const TESTER_TRANSITIONS = {
  "Ready for Retest": ["Closed", "Reopened"],
  Open: ["Rejected"],
};

// Tester edits a bug of a project they are assigned to
async function updateBugByTester(uuid, data, user) {
  const {
    projectId,
    moduleId,
    severity,
    title,
    description,
    status,
    discoverySource,
    fixNotes,
    testNotes,
  } = data;

  return sequelize.transaction(async (transaction) => {
    const bug = await ProjectBug.findOne({
      where: {
        uuid,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!bug) {
      throw new BugServiceError("Bug not found.", 404);
    }

    // The bug's project must be one the tester works on
    const project = await findCompanyProject(
      bug.projectId,
      user.companyId,
      transaction,
    );

    if (!project) {
      throw new BugServiceError("Bug not found.", 404);
    }

    await assertTesterOfProject(user, project.id);

    // A bug stays in its project (its lead and developers belong to it)
    if (
      projectId !== undefined &&
      projectId !== null &&
      projectId !== "" &&
      String(projectId) !== String(project.id) &&
      String(projectId) !== String(project.uuid)
    ) {
      throw new BugServiceError(
        "A bug can't be moved to another project.",
        400,
      );
    }

    const nextStatus = status ?? bug.status;

    if (
      nextStatus !== bug.status &&
      !(TESTER_TRANSITIONS[bug.status] || []).includes(nextStatus)
    ) {
      throw new BugServiceError(
        `A tester can't change a bug from "${bug.status}" to "${nextStatus}".`,
        409,
      );
    }

    const module = await getProjectModule(moduleId, project.id, transaction);

    validateTesterBug({
      title,
      status: nextStatus,
      severity,
      discoverySource,
    });

    const updates = {
      description,
      fixNotes,
      title,
      status: nextStatus,
      severity,
      discoverySource,
      moduleId: module?.id ?? null,
    };

    // Fix failed → back to the project lead to reassign
    if (nextStatus === "Reopened") {
      updates.assignedTo = null;
    }

    // Record the retest result on the open retest attempt
    if (bug.status === "Ready for Retest" && nextStatus !== bug.status) {
      const attempt = await BugTesting.findOne({
        where: { bugId: bug.id, status: { [Op.in]: ["Pending", "In Progress"] } },
        order: [["attemptNumber", "DESC"]],
        transaction,
      });

      if (attempt) {
        await attempt.update(
          {
            status: nextStatus === "Closed" ? "Passed" : "Failed",
            testNotes: testNotes?.trim() || attempt.testNotes || null,
            testedAt: new Date(),
          },
          { transaction },
        );
      }
    }

    await bug.update(updates, { transaction });

    return bug;
  });
}

// ---------------------------------------------------------------------------
// Retesting (Tester → Retesting page)
// Bugs the project lead sent for retest, with their latest retest attempt.
// ---------------------------------------------------------------------------

const ATTEMPT_RESULT = {
  Pending: "Pending",
  "In Progress": "Pending",
  Passed: "Passed",
  Failed: "Failed",
};

async function getRetestQueue(user) {
  const employee = await findActiveEmployee(user.userId, user.companyId);

  if (!employee) return [];

  // Only projects this tester is assigned to
  const projectIds = await getTesterProjectIds(employee.id, user.companyId);

  if (!projectIds.length) return [];

  const attempts = await BugTesting.findAll({
    where: { projectId: { [Op.in]: projectIds } },
    order: [["attemptNumber", "DESC"]],
    limit: MAX_LIST_ROWS,
    raw: true,
  });

  // Latest attempt per bug
  const latestByBug = new Map();
  for (const attempt of attempts) {
    if (!latestByBug.has(attempt.bugId)) latestByBug.set(attempt.bugId, attempt);
  }

  if (!latestByBug.size) return [];

  const bugs = await ProjectBug.findAll({
    where: {
      id: { [Op.in]: [...latestByBug.keys()] },
      projectId: { [Op.in]: projectIds },
    },
    include: [
      { model: Project, as: "project", attributes: ["uuid", "name"] },
      {
        model: ProjectModule,
        as: "module",
        attributes: ["uuid", "name"],
        required: false,
      },
    ],
  });

  const rows = bugs.map((bug) => {
    const attempt = latestByBug.get(bug.id);

    return {
      uuid: bug.uuid,
      title: bug.title,
      severity: bug.severity,
      bugStatus: bug.status,
      project: bug.project ? { uuid: bug.project.uuid, name: bug.project.name } : null,
      module: bug.module ? { uuid: bug.module.uuid, name: bug.module.name } : null,
      attemptNumber: attempt.attemptNumber,
      result: ATTEMPT_RESULT[attempt.status] || "Pending",
      testNotes: attempt.testNotes,
      testedAt: attempt.testedAt,
      // Only bugs waiting for retest can get a result
      canRecord: bug.status === "Ready for Retest",
    };
  });

  // Waiting first, then most recently tested
  return rows.sort((a, b) => {
    if (a.canRecord !== b.canRecord) return a.canRecord ? -1 : 1;
    return new Date(b.testedAt || 0) - new Date(a.testedAt || 0);
  });
}

/**
 * Tester records a retest result:
 *  - Passed → bug Closed
 *  - Failed → bug Reopened + unassigned → back to the project lead
 * Only for bugs "Ready for Retest" in a project the tester is assigned to.
 */
async function recordRetestResult(uuid, data, user) {
  const { result } = data;
  const testNotes = typeof data.testNotes === "string" ? data.testNotes.trim() : "";

  if (!["Passed", "Failed"].includes(result)) {
    throw new BugServiceError("Result must be Passed or Failed.", 400);
  }

  if (result === "Failed" && !testNotes) {
    throw new BugServiceError("Add a note explaining why the retest failed.", 400);
  }

  return sequelize.transaction(async (transaction) => {
    const bug = await ProjectBug.findOne({
      where: { uuid },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!bug) throw new BugServiceError("Bug not found.", 404);

    const project = await findCompanyProject(bug.projectId, user.companyId, transaction);

    if (!project) throw new BugServiceError("Bug not found.", 404);

    await assertTesterOfProject(user, project.id);

    if (bug.status !== "Ready for Retest") {
      throw new BugServiceError(
        `This bug is "${bug.status}" — only bugs waiting for retest can get a result.`,
        409,
      );
    }

    let attempt = await BugTesting.findOne({
      where: { bugId: bug.id, status: { [Op.in]: ["Pending", "In Progress"] } },
      order: [["attemptNumber", "DESC"]],
      transaction,
    });

    // Older data may have no open attempt — create it so history is complete
    if (!attempt) {
      attempt = await BugTesting.create(
        {
          projectId: project.id,
          bugId: bug.id,
          attemptNumber: await nextAttemptNumber(bug.id, transaction),
          status: "Pending",
        },
        { transaction },
      );
    }

    await attempt.update(
      {
        status: result,
        testNotes: testNotes || null,
        testedAt: new Date(),
      },
      { transaction },
    );

    await bug.update(
      result === "Passed"
        ? { status: "Closed" }
        : { status: "Reopened", assignedTo: null },
      { transaction },
    );

    return {
      uuid: bug.uuid,
      bugStatus: bug.status,
      result,
      attemptNumber: attempt.attemptNumber,
    };
  });
}

const createServiceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Get the authenticated client's active profile.
 */
const getClient = async (userId, companyId) => {
  const client = await Client.findOne({
    where: {
      userId,
      companyId,
      isActive: true,
    },
    attributes: ["id"],
  });

  if (!client) {
    throw createServiceError("Client account not found.", 404);
  }

  return client;
};

/**
 * Create a ticket submitted by a client.
 */
const createIssueReport = async (user, payload) => {
  const { userId, companyId } = user;

  const {
    projectId,
    title,
    description,
    severity = "Medium",
    classification = "Bug",
  } = payload;

  if (!projectId) {
    throw createServiceError("Project is required.");
  }

  if (!title || !title.trim()) {
    throw createServiceError("Ticket title is required.");
  }

  const allowedClassifications = ["Bug", "Issue", "Change Request"];

  const allowedSeverities = ["Low", "Medium", "High", "Critical"];

  if (!allowedClassifications.includes(classification)) {
    throw createServiceError("Invalid ticket type.");
  }

  if (!allowedSeverities.includes(severity)) {
    throw createServiceError("Invalid severity.");
  }

  const client = await getClient(userId, companyId);

  // Ensure the project belongs to this client and company.
  const project = await Project.findOne({
    where: {
      uuid: projectId,
      clientId: client.id,
      companyId,
    },
    attributes: ["id"],
  });

  if (!project) {
    throw createServiceError(
      "Project not found or you do not have access to it.",
      404,
    );
  }

  const issue = await IssueReport.create({
    projectId: project.id,
    title: title.trim(),
    description: description?.trim() || null,
    classification,
    severity,
    status: "Under Review",
    reportedBy: userId,
  });

  return issue;
};

/**
 * Get all tickets belonging to the authenticated client.
 */
const getClientIssueReports = async (user) => {
  const { userId, companyId } = user;

  const client = await getClient(userId, companyId);

  const projects = await Project.findAll({
    where: {
      clientId: client.id,
      companyId,
    },
    attributes: ["id"],
  });

  const projectIds = projects.map((project) => project.id);

  if (!projectIds.length) {
    return [];
  }

  const issues = await IssueReport.findAll({
    where: {
      projectId: {
        [Op.in]: projectIds,
      },
    },
    order: [["createdAt", "DESC"]],
    limit: MAX_LIST_ROWS,
  });

  return issues;
};

module.exports = {
  createBug,
  getProjectBugs,
  getDevs,
  updateBug,
  SEVERITIES,
  STATUSES,
  DISCOVERY_SOURCES,
  getAssignedBugs,
  projectsDropdown,
  updateStatus,
  getReportedIssues,
  getIssuesForTester,
  createBugByTester,
  getBugsInTester,
  updateBugByTester,
  updateStatusDEV,
  createIssueReport,
  getClientIssueReports,
  getRetestQueue,
  recordRetestResult,
};