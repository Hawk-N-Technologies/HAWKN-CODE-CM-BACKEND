"use strict";

const {
  Project,
  Employee,
  Client,
  User,
  ProjectOperation,
} = require("../models/associations");

const { uploadDirectory } = require("../middleware/planningUpload");
const path = require("path");
const fs = require("fs/promises");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ");

async function getAssignedProject(projectUuid, userId, companyId) {
  const employee = await Employee.findOne({
    where: { userId, companyId, employmentStatus: "Active" },
    attributes: ["id"],
  });

  if (!employee) {
    throw httpError(403, "Active employee record not found.");
  }

  const project = await Project.findOne({
    where: {
      uuid: projectUuid,
      companyId,
      projectLeadId: employee.id,
    },
    attributes: [
      "id",
      "uuid",
      "name",
      "description",
      "deadline",
      "status",
    ],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName"],
          },
        ],
      },
    ],
  });

  if (!project) {
    throw httpError(404, "Project not found or not assigned to you.");
  }

  return project;
}

function serialize(project, operation) {
  return {
    uuid: project.uuid,
    name: project.name,
    description: project.description || "",
    deadline: dateOnly(project.deadline),
    clientName: fullName(project.client?.user) || "—",
    technologyStack: operation?.technologyStack || "",
    erDiagramUploaded: Boolean(operation?.erDiagramPath),
    flowchartUploaded: Boolean(operation?.flowchartPath),
    planningStatus: operation?.planningStatus || "NOT_STARTED",
  };
}

async function listMyProjects(userId, companyId) {
  const employee = await Employee.findOne({
    where: { userId, companyId, employmentStatus: "Active" },
    attributes: ["id"],
  });

  if (!employee) {
    throw httpError(403, "Active employee record not found.");
  }

  const projects = await Project.findAll({
    where: { companyId, projectLeadId: employee.id },
    attributes: ["id", "uuid", "name", "description", "deadline", "status"],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id"],
        include: [
          {
            model: User,
            as: "user",
            attributes: ["firstName", "lastName"],
          },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: 500,
  });

  const operations = await ProjectOperation.findAll({
    where: {
      companyId,
      projectId: projects.map((project) => project.id),
    },
  });

  const operationByProjectId = new Map(
    operations.map((operation) => [operation.projectId, operation]),
  );

  return projects.map((project) =>
    serialize(project, operationByProjectId.get(project.id)),
  );
}

async function getPlanning(projectUuid, userId, companyId) {
  const project = await getAssignedProject(projectUuid, userId, companyId);

  const operation = await ProjectOperation.findOne({
    where: { projectId: project.id, companyId },
  });

  return serialize(project, operation);
}

async function savePlanning(
  projectUuid,
  userId,
  companyId,
  payload,
  files,
) {
  const project = await getAssignedProject(projectUuid, userId, companyId);

  const technologyStack = String(payload.technologyStack || "").trim();
  const description = String(payload.description || "").trim();
  const deadline = payload.deadline || null;

  if (technologyStack.length > 100) {
    throw httpError(400, "Technology stack must be 100 characters or fewer.");
  }

  if (description.length > 10000) {
    throw httpError(400, "Project information must be 10,000 characters or fewer.");
  }

  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    throw httpError(400, "Enter a valid project deadline.");
  }

  let operation = await ProjectOperation.findOne({
    where: { projectId: project.id, companyId },
  });

  const updates = {
    technologyStack: technologyStack || null,
    planningStatus: "IN_PROGRESS",
    updatedBy: userId,
  };

  const erFile = files?.erDiagram?.[0];
  const flowFile = files?.flowchart?.[0];

  if (erFile) {
    updates.erDiagramPath = erFile.filename;
    updates.erDiagramStatus = "UPLOADED";
  }

  if (flowFile) {
    updates.flowchartPath = flowFile.filename;
    updates.flowchartStatus = "UPLOADED";
  }

  if (!operation) {
    operation = await ProjectOperation.create({
      projectId: project.id,
      companyId,
      projectLeadId: (
        await Employee.findOne({
          where: { userId, companyId },
          attributes: ["id"],
        })
      ).id,
      createdBy: userId,
      ...updates,
    });
  } else {
    await operation.update(updates);
  }

  await project.update({
    description: description || null,
    deadline,
  });

  return serialize(project, operation);
}

async function getPlanningFile(projectUuid, kind, userId, companyId) {
  if (!["erDiagram", "flowchart"].includes(kind)) {
    throw httpError(400, "Invalid planning document type.");
  }

  const project = await getAssignedProject(projectUuid, userId, companyId);
  const operation = await ProjectOperation.findOne({
    where: { projectId: project.id, companyId },
  });

  const filename =
    kind === "erDiagram"
      ? operation?.erDiagramPath
      : operation?.flowchartPath;

  if (!filename) {
    throw httpError(404, "No document has been uploaded for this field.");
  }

  const safeFilename = path.basename(filename);
  const absolutePath = path.join(uploadDirectory, safeFilename);

  try {
    await fs.access(absolutePath);
  } catch {
    throw httpError(404, "The stored planning document is missing.");
  }

  return absolutePath;
}

module.exports = {
  listMyProjects,
  getPlanning,
  savePlanning,
  getPlanningFile,
};