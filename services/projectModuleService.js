// services/projectModule.service.js

const Project = require("../models/Project");
const ProjectModule = require("../models/ProjectModule");

const ALLOWED_FIELDS = [
  "name",
  "description",
  "priority",
  "status",
  "sortOrder",
];

const getProjectByUuid = async (projectUuid) => {
  return Project.findOne({
    where: { uuid: projectUuid },
  });
};

const getModuleByUuid = async (uuid) => {
  return ProjectModule.findOne({
    where: { uuid },
  });
};

const createModule = async (projectUuid, data) => {
  const project = await getProjectByUuid(projectUuid);

  if (!project) {
    return { notFound: "Project" };
  }

  const module = await ProjectModule.create({
    projectId: project.id,
    name: data.name.trim(),
    description: data.description ?? null,
    priority: data.priority ?? "Medium",
    status: data.status ?? "Not Started",
    sortOrder: data.sortOrder ?? 0,
  });

  return { data: module };
};

const getModulesByProject = async (projectUuid) => {
  const project = await getProjectByUuid(projectUuid);

  if (!project) {
    return { notFound: "Project" };
  }

  const modules = await ProjectModule.findAll({
    where: { projectId: project.id },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });

  return { data: modules };
};

const getModule = async (uuid) => {
  return getModuleByUuid(uuid);
};

const updateModule = async (uuid, data) => {
  const module = await getModuleByUuid(uuid);

  if (!module) return null;

  const updates = {};

  for (const field of ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      updates[field] = field === "name" ? data[field].trim() : data[field];
    }
  }

  await module.update(updates);

  return module;
};

const deleteModule = async (uuid) => {
  const module = await getModuleByUuid(uuid);

  if (!module) return null;

  await module.destroy();

  return module;
};

module.exports = {
  createModule,
  getModulesByProject,
  getModule,
  updateModule,
  deleteModule,
};
