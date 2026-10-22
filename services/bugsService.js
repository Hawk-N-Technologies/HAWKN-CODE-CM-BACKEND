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
const { TIERS } = require("../validations/project.validation");
const ProjectOperationTester = require("../models/ProjectOperationTester");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectModule = require("../models/ProjectModule");
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

async function createBug(userId, data) {
  const { projectId, moduleId, title, description, severity, discoverySource } =
    data;

  const project = await Project.findOne({
    where: { uuid: projectId },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  return IssueReport.create({
    projectId: project.id,
    moduleId: moduleId,
    title: title.trim(),
    description: description.trim(),
    severity: severity || "Medium",
    discoverySource: "Client",
    reportedBy: userId,
    status: "Submitted",
    classification: "Bug",
  });
}

async function getProjectBugs(projectId, filters = {}) {
  const { status, severity, moduleId } = filters;

  const project = await Project.findOne({
    where: { uuid: projectId },
  });

  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }

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
    const module = await ProjectModule.findOne({
      where: {
        uuid: moduleId,
      },
    });

    if (!module) {
      const error = new Error("Module not found.");
      error.statusCode = 404;
      throw error;
    }

    where.moduleId = module.id;
  }

  return ProjectBug.findAll({
    where,
    order: [["createdAt", "DESC"]],
  });
}

async function getDevs() {
  return Employee.findAll({
    attributes: ["id", "uuid", "userId"],
    where: {
      employmentStatus: "Active",
    },
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "firstName", "lastName"],
        required: true,
        where: {
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

async function updateBug(bugId, projectId, data) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const project = await Project.findOne({
      where: { uuid: projectId },
      transaction,
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    const bug = await ProjectBug.findOne({
      where: {
        uuid: bugId,
        projectId: project.id,
      },
      transaction,
    });

    if (!bug) {
      throw new Error("Bug not found in this project.");
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
      updates.moduleId = data.moduleId || null;
    }

    if (data.assignedTo !== undefined) {
      updates.assignedTo = data.assignedTo || null;

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
          attemptNumber: 1,
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

async function getAssignedBugs(employeeId, projectId, moduleId) {
  try {
    const employee = await Employee.findOne({
      where: {
        userId: employeeId,
      },
    });

    console.log(employee);
    const bugs = await ProjectBug.findAll({
      where: {
        assignedTo: employee.id,
        projectId: projectId,
      },
      order: [["createdAt", "DESC"]],
    });

    return bugs;
  } catch (error) {
    console.error("Error fetching assigned bugs:", error);
    throw error;
  }
}

async function projectsDropdown() {
  try {
    const projects = await Project.findAll({
      attributes: ["id", "uuid", "name"],
    });

    return projects;
  } catch (error) {
    console.log(error);
  }
}
const ALLOWED_STATUSES = ["Fixed", "In Progress", "Assigned"];

async function updateStatusDEV(uuid, status) {
  try {
    console.log("i am ;in l;jlkj; kl;j ;");
    if (!uuid || typeof uuid !== "string") {
      const error = new Error("Valid bug UUID is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      const error = new Error(
        `Invalid status. Allowed statuses: ${ALLOWED_STATUSES.join(", ")}.`,
      );
      error.statusCode = 400;
      throw error;
    }

    const bug = await ProjectBug.findOne({
      where: { uuid },
    });

    if (bug.status == "Ready for Retest") {
      return;
    }

    if (!bug) {
      const error = new Error("Bug not found.");
      error.statusCode = 404;
      throw error;
    }

    await bug.update({ status });

    return bug;
  } catch (error) {
    console.log(error);
  }
}

async function getReportedIssues(userId) {
  try {
    const res = await IssueReport.findAll({
      where: {
        reportedBy: userId,
      },
    });

    return res;
  } catch (talha) {
    console.log(talha);
  }
}

async function getIssuesForTester(userId) {
  try {
    const employee = await Employee.findOne({
      where: {
        userId,
      },
    });

    if (!employee) {
      return [];
    }

    const projectOperations = await ProjectOperationTester.findAll({
      where: {
        employee_id: employee.id,
      },
      attributes: ["projectOperationId"],
      raw: true,
    });

    if (!projectOperations.length) {
      return [];
    }

    const projectOperationIds = projectOperations.map(
      (item) => item.projectOperationId,
    );

    const projects = await ProjectOperation.findAll({
      where: {
        id: {
          [Op.in]: projectOperationIds,
        },
      },
      attributes: ["projectId"],
      raw: true,
    });

    if (!projects.length) {
      return [];
    }

    const projectIds = [...new Set(projects.map((item) => item.projectId))];

    const issues = await IssueReport.findAll({
      where: {
        projectId: {
          [Op.in]: projectIds,
        },
      },
    });

    return issues;
  } catch (error) {
    console.error("Error fetching issues for tester:", error);
    throw error;
  }
}

async function updateStatus(uuid, status, classification) {
  try {
    const issue = await IssueReport.findOne({
      where: {
        uuid,
      },
    });

    if (!issue) {
      const error = new Error("Issue report not found.");
      error.statusCode = 404;
      throw error;
    }

    const STATUSES = [
      "Submitted",
      "Under Review",
      "Confirmed",
      "Feature Request",
      "Rejected",
    ];

    const CLASSIFICATIONS = ["Bug", "Feature Request"];

    if (!STATUSES.includes(status)) {
      const error = new Error("Invalid issue status.");
      error.statusCode = 400;
      throw error;
    }

    if (classification != null && !CLASSIFICATIONS.includes(classification)) {
      const error = new Error("Invalid issue classification.");
      error.statusCode = 400;
      throw error;
    }

    await issue.update({
      status,
      classification,
    });
    console.log(issue);
    return issue;
  } catch (talha) {
    console.error("Update issue status error:", talha);
    throw talha;
  }
}
async function createBugByTester(data) {
  try {
    const {
      projectId,
      moduleId,
      severity = "Medium",
      title,
      status = "Open",
      discoverySource = "Testing",
    } = data;

    const project = await Project.findOne({
      uuid: projectId,
    });
    const module = await ProjectModule.findOne({
      uuid: moduleId,
    });

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

    const SEVERITIES = ["Low", "Medium", "High", "Critical"];

    const DISCOVERY_SOURCES = [
      "Client",
      "Testing",
      "Development",
      "Code Review",
      "Production",
      "Retesting",
    ];

    if (!project) {
      const talha = new Error("Project ID is required.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!title || !title.trim()) {
      const talha = new Error("Bug title is required.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!STATUSES.includes(status)) {
      const talha = new Error("Invalid bug status.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!SEVERITIES.includes(severity)) {
      const talha = new Error("Invalid bug severity.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!DISCOVERY_SOURCES.includes(discoverySource)) {
      const talha = new Error("Invalid discovery source.");
      talha.statusCode = 400;
      throw talha;
    }

    const bug = await ProjectBug.create({
      projectId: project.id,
      moduleId: module.id ?? null,
      severity,
      title: title.trim(),
      status,
      discoverySource,
    });

    return bug;
  } catch (talha) {
    console.error("Create bug by tester error:", talha);
    throw talha;
  }
}
async function getBugsInTester(userId) {
  try {
    const employee = await Employee.findOne({
      where: {
        userId,
      },
    });

    if (!employee) {
      return [];
    }

    const projectOperations = await ProjectOperationTester.findAll({
      where: {
        employee_id: employee.id,
      },
      attributes: ["projectOperationId"],
      raw: true,
    });

    if (!projectOperations.length) {
      return [];
    }

    const projectOperationIds = projectOperations.map(
      (item) => item.projectOperationId,
    );

    const projects = await ProjectOperation.findAll({
      where: {
        id: {
          [Op.in]: projectOperationIds,
        },
      },
      attributes: ["projectId"],
      raw: true,
    });

    if (!projects.length) {
      return [];
    }

    const projectIds = [...new Set(projects.map((item) => item.projectId))];

    const bugs = await ProjectBug.findAll({
      where: {
        projectId: {
          [Op.in]: projectIds,
        },
      },
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

    return bugs;
  } catch (talha) {
    console.log(talha);
    throw talha;
  }
}

async function updateBugByTester(uuid, data) {
  try {
    const {
      projectId,
      moduleId,
      severity,
      title,
      description,
      status,
      discoverySource,
      fixNotes,
    } = data;

    const project = await Project.findOne({
      uuid: projectId,
    });
    const module = await ProjectModule.findOne({
      uuid: moduleId,
    });

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

    const SEVERITIES = ["Low", "Medium", "High", "Critical"];

    const DISCOVERY_SOURCES = [
      "Client",
      "Testing",
      "Development",
      "Code Review",
      "Production",
      "Retesting",
    ];

    if (!project) {
      const talha = new Error("Project ID is required.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!title || !title.trim()) {
      const talha = new Error("Bug title is required.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!STATUSES.includes(status)) {
      const talha = new Error("Invalid bug status.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!SEVERITIES.includes(severity)) {
      const talha = new Error("Invalid bug severity.");
      talha.statusCode = 400;
      throw talha;
    }

    if (!DISCOVERY_SOURCES.includes(discoverySource)) {
      const talha = new Error("Invalid discovery source.");
      talha.statusCode = 400;
      throw talha;
    }
    const bug = await ProjectBug.findOne({
      where: {
        uuid,
      },
    });

    await bug.update({
      description,
      fixNotes,
      title,
      status,
      severity,
      discoverySource,
      moduleId: module.id ?? null,
      projectId: project.id,
    });
  } catch (talha) {
    console.log(talha);
  }
}

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
};
