"use strict";

const {
  ProjectOperation,
  Project,
  Employee,
  User,
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
    where: { userId, companyId, employmentStatus: "Active" },
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
  // Many-to-many assignments created by Admin → Operations.
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

  // Support both the current multi-tester assignment and legacy tester_id.
  const assigned = operations.filter(
    (operation) =>
      operation.testerId === employee.id ||
      (operation.testers || []).some(
        (tester) => tester.id === employee.id,
      ),
  );

  // A project can be assigned through both mechanisms. Return it once.
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
    where: { testerId: employee.id },
    attributes: ["id", "status"],
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        where: { companyId },
        attributes: [],
      },
    ],
  });

  const testingQueue = testingRecords.filter((record) =>
    ["Pending", "In Progress"].includes(record.status),
  ).length;

  return {
    assignedProjects: projects.length,
    testingQueue,
    // There is no dedicated bug or retesting model in the supplied dev ZIP.
    // Do not report fabricated zero counts as if they were live data.
    openBugs: null,
    retesting: null,
    testingSummary: {
      pending: testingRecords.filter((record) => record.status === "Pending")
        .length,
      inProgress: testingRecords.filter(
        (record) => record.status === "In Progress",
      ).length,
      passed: testingRecords.filter((record) => record.status === "Passed")
        .length,
      failed: testingRecords.filter((record) => record.status === "Failed")
        .length,
    },
  };
}

module.exports = {
  getAssignedProjects,
  getOverview,
};