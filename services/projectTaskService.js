const ProjectTask = require("../models/ProjectTask");
const Project = require("../models/Project");
const ProjectModule = require("../models/ProjectModule");
const ProjectPhase = require("../models/ProjectPhase");
const Employee = require("../models/Employee");
const User = require("../models/User");

const VALID_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const VALID_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Code Review",
  "Testing",
  "Done",
];

const TASK_FIELDS = [
  "title",
  "description",
  "moduleId",
  "phaseId",
  "assignedTo",
  "priority",
  "status",
  "isBlocked",
  "blockedReason",
  "startDate",
  "dueDate",
  "estimatedHours",
  "actualHours",
  "sortOrder",
];

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const validateDates = (values) => {
  const { startDate, dueDate } = values;

  if (startDate && dueDate && dueDate < startDate) {
    throw new Error("Due date cannot be before start date");
  }
};

const validateHours = (values) => {
  for (const field of ["estimatedHours", "actualHours"]) {
    const value = values[field];

    if (value !== undefined && value !== null) {
      if (
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      ) {
        throw new Error(`${field} must be a non-negative number`);
      }
    }
  }
};

const validateTaskValues = (values) => {
  if (
    values.title !== undefined &&
    (typeof values.title !== "string" || !values.title.trim())
  ) {
    throw new Error("Task title is required");
  }

  if (values.title !== undefined && values.title.trim().length > 255) {
    throw new Error("Task title cannot exceed 255 characters");
  }

  if (
    values.priority !== undefined &&
    !VALID_PRIORITIES.includes(values.priority)
  ) {
    throw new Error("Invalid task priority");
  }

  if (values.status !== undefined && !VALID_STATUSES.includes(values.status)) {
    throw new Error("Invalid task status");
  }

  if (values.isBlocked !== undefined && typeof values.isBlocked !== "boolean") {
    throw new Error("isBlocked must be a boolean");
  }

  if (
    values.sortOrder !== undefined &&
    (!Number.isInteger(Number(values.sortOrder)) ||
      Number(values.sortOrder) < 0)
  ) {
    throw new Error("sortOrder must be a non-negative integer");
  }

  if (values.isBlocked === true && !String(values.blockedReason || "").trim()) {
    throw new Error("Blocked reason is required for a blocked task");
  }

  validateDates(values);
  validateHours(values);
};

const getProject = async (projectUuid) => {
  const project = await Project.findOne({
    where: { uuid: projectUuid },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
};

const validateModuleAndPhase = async ({ projectId, moduleId, phaseId }) => {
  let projectModule = null;
  let projectPhase = null;

  if (moduleId !== undefined && moduleId !== null) {
    projectModule = await ProjectModule.findByPk(moduleId);

    if (
      !projectModule ||
      Number(projectModule.projectId) !== Number(projectId)
    ) {
      throw new Error("Module does not belong to this project");
    }
  }

  if (phaseId !== undefined && phaseId !== null) {
    projectPhase = await ProjectPhase.findByPk(phaseId);

    if (!projectPhase || Number(projectPhase.projectId) !== Number(projectId)) {
      throw new Error("Phase does not belong to this project");
    }

    if (
      moduleId !== undefined &&
      moduleId !== null &&
      Number(projectPhase.moduleId) !== Number(moduleId)
    ) {
      throw new Error("Phase does not belong to the selected module");
    }

    if (
      (moduleId === undefined || moduleId === null) &&
      projectPhase.moduleId
    ) {
      projectModule = await ProjectModule.findByPk(projectPhase.moduleId);

      if (
        !projectModule ||
        Number(projectModule.projectId) !== Number(projectId)
      ) {
        throw new Error("Phase has an invalid module");
      }
    }
  }

  return { projectModule, projectPhase };
};

const validateAssignment = async (assignedTo) => {
  if (assignedTo === undefined || assignedTo === null) {
    return;
  }

  if (!Number.isInteger(Number(assignedTo)) || Number(assignedTo) <= 0) {
    throw new Error("assignedTo must be a valid employee ID");
  }

  const employee = await Employee.findByPk(assignedTo);

  if (!employee) {
    throw new Error("Assigned employee not found");
  }
};

const buildTaskValues = (body) => {
  const values = {};

  for (const field of TASK_FIELDS) {
    if (hasOwn(body, field)) {
      values[field] = body[field];
    }
  }

  if (hasOwn(values, "title")) {
    values.title = values.title.trim();
  }

  if (values.isBlocked === false && !hasOwn(body, "blockedReason")) {
    values.blockedReason = null;
  }

  return values;
};

const createTask = async (projectUuid, body, userId) => {
  const project = await getProject(projectUuid);
  const values = buildTaskValues(body);

  validateTaskValues({
    ...values,
    title: values.title,
    startDate: values.startDate ?? null,
    dueDate: values.dueDate ?? null,
  });

  await validateModuleAndPhase({
    projectId: project.id,
    moduleId: values.moduleId,
    phaseId: values.phaseId,
  });

  await validateAssignment(values.assignedTo);

  if (values.isBlocked === undefined) {
    values.isBlocked = false;
  }

  if (values.isBlocked && !String(values.blockedReason || "").trim()) {
    throw new Error("Blocked reason is required for a blocked task");
  }

  if (values.status === "Done") {
    values.completedAt = new Date();
  } else {
    values.completedAt = null;
  }

  values.projectId = project.id;
  values.createdBy = userId || null;

  return ProjectTask.create(values);
};

const listProjectTasks = async (projectUuid, filters = {}) => {
  const project = await getProject(projectUuid);
  const where = { projectId: project.id };

  if (filters.status) {
    if (!VALID_STATUSES.includes(filters.status)) {
      throw new Error("Invalid task status filter");
    }

    where.status = filters.status;
  }

  if (filters.priority) {
    if (!VALID_PRIORITIES.includes(filters.priority)) {
      throw new Error("Invalid task priority filter");
    }

    where.priority = filters.priority;
  }

  if (filters.assignedTo !== undefined && filters.assignedTo !== "") {
    where.assignedTo = filters.assignedTo;
  }

  if (filters.moduleId !== undefined && filters.moduleId !== "") {
    where.moduleId = filters.moduleId;
  }

  if (filters.phaseId !== undefined && filters.phaseId !== "") {
    where.phaseId = filters.phaseId;
  }

  if (filters.isBlocked !== undefined && filters.isBlocked !== "") {
    if (!["true", "false"].includes(String(filters.isBlocked))) {
      throw new Error("isBlocked filter must be true or false");
    }

    where.isBlocked = String(filters.isBlocked) === "true";
  }

  return ProjectTask.findAll({
    where,
    order: [
      ["sortOrder", "ASC"],
      ["createdAt", "DESC"],
    ],
  });
};

const listModuleTasks = async (projectUuid, moduleUuid, filters = {}) => {
  const project = await getProject(projectUuid);

  const projectModule = await ProjectModule.findOne({
    where: {
      uuid: moduleUuid,
      projectId: project.id,
    },
  });

  if (!projectModule) {
    throw new Error("Module not found in this project");
  }

  return listProjectTasks(projectUuid, {
    ...filters,
    moduleId: projectModule.id,
  });
};

const listPhaseTasks = async (
  projectUuid,
  moduleUuid,
  phaseUuid,
  filters = {},
) => {
  const project = await getProject(projectUuid);

  const projectModule = await ProjectModule.findOne({
    where: {
      uuid: moduleUuid,
      projectId: project.id,
    },
  });

  if (!projectModule) {
    throw new Error("Module not found in this project");
  }

  const projectPhase = await ProjectPhase.findOne({
    where: {
      uuid: phaseUuid,
      projectId: project.id,
      moduleId: projectModule.id,
    },
  });

  if (!projectPhase) {
    throw new Error("Phase not found in this module");
  }

  return listProjectTasks(projectUuid, {
    ...filters,
    moduleId: projectModule.id,
    phaseId: projectPhase.id,
  });
};

const getTaskByUuid = async (uuid) => {
  const task = await ProjectTask.findOne({
    where: { uuid },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return task;
};

const updateTask = async (uuid, body) => {
  const task = await getTaskByUuid(uuid);
  const values = buildTaskValues(body);

  validateTaskValues({
    title: values.title,
    priority: values.priority,
    status: values.status,
    isBlocked: values.isBlocked,
    blockedReason: values.blockedReason,
    startDate: hasOwn(values, "startDate") ? values.startDate : task.startDate,
    dueDate: hasOwn(values, "dueDate") ? values.dueDate : task.dueDate,
    estimatedHours: values.estimatedHours,
    actualHours: values.actualHours,
    sortOrder: values.sortOrder,
  });

  const nextModuleId = hasOwn(values, "moduleId")
    ? values.moduleId
    : task.moduleId;

  const nextPhaseId = hasOwn(values, "phaseId") ? values.phaseId : task.phaseId;

  if (
    (nextModuleId !== undefined && nextModuleId !== null) ||
    (nextPhaseId !== undefined && nextPhaseId !== null)
  ) {
    await validateModuleAndPhase({
      projectId: task.projectId,
      moduleId: nextModuleId,
      phaseId: nextPhaseId,
    });
  }

  if (hasOwn(values, "assignedTo")) {
    await validateAssignment(values.assignedTo);
  }

  if (values.isBlocked === true) {
    const reason = hasOwn(values, "blockedReason")
      ? values.blockedReason
      : task.blockedReason;

    if (!String(reason || "").trim()) {
      throw new Error("Blocked reason is required for a blocked task");
    }
  }

  if (values.isBlocked === false && !hasOwn(values, "blockedReason")) {
    values.blockedReason = null;
  }

  const nextStatus = hasOwn(values, "status") ? values.status : task.status;

  if (nextStatus === "Done") {
    if (task.status !== "Done") {
      values.completedAt = new Date();
    }
  } else if (hasOwn(values, "status")) {
    values.completedAt = null;
  }

  await task.update(values);

  return task;
};

const deleteTask = async (uuid) => {
  const task = await getTaskByUuid(uuid);

  await task.destroy();

  return task;
};

module.exports = {
  createTask,
  listProjectTasks,
  listModuleTasks,
  listPhaseTasks,
  getTaskByUuid,
  updateTask,
  deleteTask,
};
