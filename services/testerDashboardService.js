"use strict";

const {
  ProjectOperation,
  Project,
  Employee,
  User,
  TaskTester,
  TaskTesting,
} = require("../models/associations");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "—";

async function getTester(userId, companyId) {
  const employee = await Employee.findOne({
    where: {
      userId,
      companyId,
      employmentStatus: "Active",
    },
    attributes: ["id", "uuid", "userId", "companyId"],
  });

  if (!employee) {
    throw httpError(403, "Active tester employee record not found.");
  }

  return employee;
}

function serializeProject(operation) {
  const project = operation.project;
  const lead = operation.projectLead?.user;

  return {
    uuid: project.uuid,
    name: project.name,
    status: project.status,
    progress: Number(project.progress || 0),
    startDate: project.startDate || null,
    deadline: project.deadline || null,
    projectLead: fullName(lead),
  };
}

async function getAssignedProjectsForEmployee(employee) {
  const operations = await ProjectOperation.findAll({
    where: { companyId: employee.companyId },
    attributes: ["id", "projectId", "testerId", "projectLeadId"],
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        where: { companyId: employee.companyId },
        attributes: [
          "id",
          "uuid",
          "name",
          "status",
          "progress",
          "startDate",
          "deadline",
        ],
      },
      {
        model: Employee,
        as: "projectLead",
        required: false,
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName"],
          },
        ],
      },
      {
        model: Employee,
        as: "testers",
        required: false,
        attributes: ["id"],
        through: { attributes: [] },
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  const assigned = operations.filter(
    (operation) =>
      operation.testerId === employee.id ||
      (operation.testers || []).some((tester) => tester.id === employee.id),
  );

  const unique = new Map();

  for (const operation of assigned) {
    if (!unique.has(operation.project.uuid)) {
      unique.set(operation.project.uuid, serializeProject(operation));
    }
  }

  return [...unique.values()];
}

async function getAssignedProjects(userId, companyId) {
  const employee = await getTester(userId, companyId);
  return getAssignedProjectsForEmployee(employee);
}

async function getOverview(userId, companyId) {
  const employee = await getTester(userId, companyId);
  const projects = await getAssignedProjectsForEmployee(employee);

  const testingRecords = await TaskTesting.findAll({
    attributes: ["id", "status"],
    include: [
      {
        model: TaskTester,
        as: "testerAssignment",
        required: true,
        where: { testerId: employee.id },
        attributes: [],
      },
      {
        model: Project,
        as: "project",
        required: true,
        where: { companyId },
        attributes: [],
      },
    ],
  });

  const testingSummary = {
    pending: 0,
    inProgress: 0,
    passed: 0,
    failed: 0,
  };

  for (const record of testingRecords) {
    switch (record.status) {
      case "Pending":
        testingSummary.pending++;
        break;
      case "In Progress":
        testingSummary.inProgress++;
        break;
      case "Passed":
        testingSummary.passed++;
        break;
      case "Failed":
        testingSummary.failed++;
        break;
    }
  }

  return {
    assignedProjects: projects.length,
    testingQueue: testingSummary.pending + testingSummary.inProgress,
    openBugs: null,
    retesting: null,
    testingSummary,
  };
}

module.exports = {
  getAssignedProjects,
  getOverview,
};
