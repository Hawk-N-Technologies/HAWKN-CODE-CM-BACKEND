"use strict";

const { Op } = require("@sequelize/core");
const sequelize = require("../config/db");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Role = require("../models/Role");
const Project = require("../models/Project");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectOperationDeveloper = require("../models/ProjectOperationDeveloper");
const ProjectOperationTester = require("../models/ProjectOperationTester");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const normalizeRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

function employeeName(employee) {
  const user = employee?.user;

  return (
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    employee?.companyEmail ||
    user?.email ||
    `Employee ${employee?.id}`
  );
}

const employeeInclude = {
  model: User,
  as: "user",
  required: true,
  attributes: ["id", "firstName", "lastName", "email"],
  include: [
    {
      model: Role,
      as: "role",
      required: true,
      attributes: ["id", "name"],
    },
  ],
};

async function resolveEmployee(userId, companyId, transaction) {
  const employee = await Employee.findOne({
    where: { userId, companyId, employmentStatus: "Active" },
    transaction,
  });

  if (!employee) {
    throw httpError(403, "Active employee record not found.");
  }

  return employee;
}

async function getLeadProjects(userId, companyId) {
  const employee = await resolveEmployee(userId, companyId);

  const plans = await ProjectOperation.findAll({
    where: {
      companyId,
      projectLeadId: employee.id,
    },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        attributes: ["id", "uuid", "name", "status"],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  return plans.map((plan) => ({
    uuid: plan.project.uuid,
    name: plan.project.name,
    status: plan.project.status,
  }));
}

async function getTeam(projectUuid, userId, companyId) {
  const employee = await resolveEmployee(userId, companyId);

  const plan = await ProjectOperation.findOne({
    where: {
      companyId,
      projectLeadId: employee.id,
    },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        where: { uuid: projectUuid, companyId },
        attributes: ["id", "uuid", "name", "status"],
      },
      {
        model: Employee,
        as: "projectLead",
        required: false,
        include: [employeeInclude],
      },
      {
        model: Employee,
        as: "developers",
        required: false,
        through: { attributes: [] },
        include: [employeeInclude],
      },
      {
        model: Employee,
        as: "testers",
        required: false,
        through: { attributes: [] },
        include: [employeeInclude],
      },
    ],
  });

  if (!plan) {
    throw httpError(404, "Project not found or not assigned to you as lead.");
  }

  const employees = await Employee.findAll({
    where: { companyId, employmentStatus: "Active" },
    include: [employeeInclude],
    order: [["id", "ASC"]],
  });

  const toPerson = (item) => ({
    id: item.id,
    name: employeeName(item),
    email: item.user?.email || item.companyEmail || "",
    role: item.user?.role?.name || "",
  });

  const people = employees.map(toPerson);
  const roleOf = (item) => normalizeRole(item.role);

  return {
    project: {
      uuid: plan.project.uuid,
      name: plan.project.name,
      status: plan.project.status,
    },
    team: {
      projectLeadId: plan.projectLeadId,
      developerIds: (plan.developers || []).map((item) => item.id),
      testerIds: (plan.testers || []).map((item) => item.id),
    },
    options: {
      projectLeads: people.filter((item) =>
        ["developer"].includes(roleOf(item)),
      ),
      developers: people.filter((item) => ["developer"].includes(roleOf(item))),
      testers: people.filter((item) =>
        ["tester", "qa", "quality assurance"].includes(roleOf(item)),
      ),
    },
    current: {
      projectLead: plan.projectLead ? toPerson(plan.projectLead) : null,
      developers: (plan.developers || []).map(toPerson),
      testers: (plan.testers || []).map(toPerson),
    },
  };
}

async function saveTeam(projectUuid, userId, companyId, payload) {
  const employee = await resolveEmployee(userId, companyId);

  const projectLeadId = Number(payload.projectLeadId);
  const developerIds = payload.developerIds;
  const testerIds = payload.testerIds;

  if (
    !Number.isInteger(projectLeadId) ||
    projectLeadId <= 0 ||
    !Array.isArray(developerIds) ||
    !Array.isArray(testerIds)
  ) {
    throw httpError(
      400,
      "Select a project lead and provide valid developer and tester lists.",
    );
  }

  const normalizedDevelopers = [...new Set(developerIds.map(Number))];
  const normalizedTesters = [...new Set(testerIds.map(Number))];

  const allIds = [projectLeadId, ...normalizedDevelopers, ...normalizedTesters];

  if (allIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw httpError(400, "One or more employee IDs are invalid.");
  }

  return sequelize
    .transaction(async (transaction) => {
      const plan = await ProjectOperation.findOne({
        where: { companyId, projectLeadId: employee.id },
        include: [
          {
            model: Project,
            as: "project",
            required: true,
            where: { uuid: projectUuid, companyId },
          },
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!plan) {
        throw httpError(
          404,
          "Project not found or not assigned to you as lead.",
        );
      }

      const selectedEmployees = await Employee.findAll({
        where: {
          id: { [Op.in]: [...new Set(allIds)] },
          companyId,
          employmentStatus: "Active",
        },
        include: [employeeInclude],
        transaction,
      });

      if (selectedEmployees.length !== new Set(allIds).size) {
        throw httpError(
          400,
          "Selected employees must be active and belong to your company.",
        );
      }

      const byId = new Map(selectedEmployees.map((item) => [item.id, item]));

      const roleOf = (id) => normalizeRole(byId.get(id)?.user?.role?.name);

      if (roleOf(projectLeadId) !== "developer") {
        throw httpError(400, "Project Lead must have the developer role.");
      }

      if (normalizedDevelopers.some((id) => roleOf(id) !== "developer")) {
        throw httpError(400, "Only developers can be assigned as developers.");
      }

      if (
        normalizedTesters.some(
          (id) => !["tester", "qa", "quality assurance"].includes(roleOf(id)),
        )
      ) {
        throw httpError(400, "Only testers or QA employees can be assigned.");
      }

      await plan.update({ projectLeadId, updatedBy: userId }, { transaction });

      await ProjectOperationDeveloper.destroy({
        where: { projectOperationId: plan.id },
        transaction,
      });

      await ProjectOperationTester.destroy({
        where: { projectOperationId: plan.id },
        transaction,
      });

      if (normalizedDevelopers.length) {
        await ProjectOperationDeveloper.bulkCreate(
          normalizedDevelopers.map((employeeId) => ({
            projectOperationId: plan.id,
            employeeId,
          })),
          { transaction },
        );
      }

      if (normalizedTesters.length) {
        await ProjectOperationTester.bulkCreate(
          normalizedTesters.map((employeeId) => ({
            projectOperationId: plan.id,
            employeeId,
          })),
          { transaction },
        );
      }

      return { success: true };
    })
    .then(() => ({ success: true }));
}

module.exports = { getLeadProjects, getTeam, saveTeam };
