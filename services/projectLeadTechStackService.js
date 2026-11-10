"use strict";

const Employee = require("../models/Employee");
const Project = require("../models/Project");
const ProjectOperation = require("../models/ProjectOperation");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function resolveEmployee(userId, companyId) {
  const employee = await Employee.findOne({
    where: { userId, companyId, employmentStatus: "Active" },
    attributes: ["id"],
  });

  if (!employee) {
    throw httpError(403, "Active employee record not found.");
  }

  return employee;
}

async function findAssignedPlan(projectUuid, userId, companyId) {
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
        attributes: ["uuid", "name", "status"],
      },
    ],
  });

  if (!plan) {
    throw httpError(404, "Project not found or not assigned to you as lead.");
  }

  return plan;
}

async function listProjects(userId, companyId) {
  const employee = await resolveEmployee(userId, companyId);

  const plans = await ProjectOperation.findAll({
    where: { companyId, projectLeadId: employee.id },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        attributes: ["uuid", "name", "status"],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  return plans.map((plan) => ({
    uuid: plan.project.uuid,
    name: plan.project.name,
    status: plan.project.status,
    technologyStack: plan.technologyStack || "",
    updatedAt: plan.updatedAt,
  }));
}

async function getStack(projectUuid, userId, companyId) {
  const plan = await findAssignedPlan(projectUuid, userId, companyId);

  return {
    uuid: plan.project.uuid,
    name: plan.project.name,
    status: plan.project.status,
    technologyStack: plan.technologyStack || "",
    updatedAt: plan.updatedAt,
  };
}

async function saveStack(projectUuid, userId, companyId, value) {
  const technologyStack = String(value ?? "").trim();

  if (technologyStack.length > 100) {
    throw httpError(400, "Technology stack must be 100 characters or fewer.");
  }

  const plan = await findAssignedPlan(projectUuid, userId, companyId);

  await plan.update({
    technologyStack: technologyStack || null,
    updatedBy: userId,
  });

  return {
    uuid: plan.project.uuid,
    name: plan.project.name,
    status: plan.project.status,
    technologyStack: plan.technologyStack || "",
    updatedAt: plan.updatedAt,
  };
}

module.exports = { listProjects, getStack, saveStack };
