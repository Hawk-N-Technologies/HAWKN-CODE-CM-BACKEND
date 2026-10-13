const Project = require("../models/Project");
const ProjectModule = require("../models/ProjectModule");
const ProjectPhase = require("../models/ProjectPhase");

const getProjectByUuid = (uuid) => Project.findOne({ where: { uuid } });

const getModuleByUuid = (uuid) => ProjectModule.findOne({ where: { uuid } });

const getPhaseByUuid = (uuid) => ProjectPhase.findOne({ where: { uuid } });

const createPhase = async (projectUuid, moduleUuid, data) => {
  const project = await getProjectByUuid(projectUuid);

  if (!project) return { notFound: "Project" };

  const module = await getModuleByUuid(moduleUuid);

  if (!module || module.projectId !== project.id) {
    return { notFound: "Module" };
  }

  const phase = await ProjectPhase.create({
    projectId: project.id,
    moduleId: module.id,
    name: data.name.trim(),
    description: data.description ?? null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    status: data.status ?? "Not Started",
    sortOrder: data.sortOrder ?? 0,
  });

  return { data: phase };
};

const getPhasesByModule = async (projectUuid, moduleUuid) => {
  const project = await getProjectByUuid(projectUuid);

  if (!project) return { notFound: "Project" };

  const module = await getModuleByUuid(moduleUuid);

  if (!module || module.projectId !== project.id) {
    return { notFound: "Module" };
  }

  const phases = await ProjectPhase.findAll({
    where: {
      projectId: project.id,
      moduleId: module.id,
    },
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
    ],
  });

  return { data: phases };
};

const getPhase = async (uuid) => getPhaseByUuid(uuid);

const updatePhase = async (uuid, data) => {
  const phase = await getPhaseByUuid(uuid);

  if (!phase) return null;

  const allowedFields = [
    "name",
    "description",
    "startDate",
    "endDate",
    "status",
    "sortOrder",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      updates[field] = field === "name" ? data[field].trim() : data[field];
    }
  }

  await phase.update(updates);

  return phase;
};

const deletePhase = async (uuid) => {
  const phase = await getPhaseByUuid(uuid);

  if (!phase) return null;

  await phase.destroy();

  return phase;
};

module.exports = {
  createPhase,
  getPhasesByModule,
  getPhase,
  updatePhase,
  deletePhase,
};
