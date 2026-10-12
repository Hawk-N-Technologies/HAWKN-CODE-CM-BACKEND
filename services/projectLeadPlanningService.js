"use strict";

const {
  Project,
  Employee,
  Client,
  User,
  ProjectOperation,
} = require("../models/associations");

const path = require("path");
const fs = require("fs");
const UPLOAD_DIR = path.resolve(__dirname, "../uploads/project-planning");

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
    erDiagramUploaded: operation?.erDiagramPath,
    flowchartUploaded: operation?.flowchartPath,
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

  console.log(operation);

  return serialize(project, operation);
}

async function savePlanning(projectUuid, userId, companyId, payload, files) {
  const project = await getAssignedProject(projectUuid, userId, companyId);

  const technologyStack = String(payload.technologyStack || "").trim();
  const description = String(payload.description || "").trim();
  const deadline = payload.deadline || null;

  if (technologyStack.length > 100) {
    throw httpError(400, "Technology stack must be 100 characters or fewer.");
  }

  if (description.length > 10000) {
    throw httpError(
      400,
      "Project information must be 10,000 characters or fewer.",
    );
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
async function getPlanningFile(projectUuid, kind) {
  const fileFieldMap = {
    erDiagram: "er_diagram_path",
    flowchart: "flowchart_path",
  };

  const field = fileFieldMap[kind];

  if (!field) {
    const error = new Error("Invalid planning document type.");
    error.statusCode = 400;
    throw error;
  }

  // Find project by UUID
  const project = await Project.findOne({
    where: { uuid: projectUuid },
    attributes: ["id", "uuid", "name"],
  });

  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }

  // Find operations record and the requested file path
  const projectOperation = await ProjectOperation.findOne({
    where: {
      project_id: project.id,
    },
    attributes: ["id", field],
  });

  if (!projectOperation) {
    const error = new Error("Project operations record not found.");
    error.statusCode = 404;
    throw error;
  }

  const storedFile = projectOperation.get(field);

  if (!storedFile) {
    const error = new Error("Planning document has not been uploaded.");
    error.statusCode = 404;
    throw error;
  }

  // Resolve the file path safely
  const fileName = path.basename(storedFile);
  const uploadDir = path.resolve(UPLOAD_DIR);
  const filePath = path.resolve(uploadDir, fileName);

  if (path.dirname(filePath) !== uploadDir) {
    const error = new Error("Invalid file path.");
    error.statusCode = 400;
    throw error;
  }

  if (!fs.existsSync(filePath)) {
    const error = new Error("Planning document was not found on disk.");
    error.statusCode = 404;
    throw error;
  }

  return {
    filePath,
    fileName,
  };
}
module.exports = {
  listMyProjects,
  getPlanning,
  savePlanning,
  getPlanningFile,
};
