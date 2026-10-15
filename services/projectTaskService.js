const ProjectTask = require("../models/ProjectTask");
const Project = require("../models/Project");
const ProjectModule = require("../models/ProjectModule");
const ProjectPhase = require("../models/ProjectPhase");
const Employee = require("../models/Employee");
const User = require("../models/User");
const Role = require("../models/Role");
const { Op } = require("@sequelize/core");
const middleware = require("../middleware/requireProjectLead");
const sequelize = require("../config/db");
const VALID_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const VALID_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Code Review",
  "Testing",
  "Done",
];
const employeeService = require("../services/employeeService");
const ProjectOperation = require("../models/ProjectOperation");
const ProjectOperationTester = require("../models/ProjectOperationTester");
const TaskTesting = require("../models/TaskTesting");
const TaskTester = require("../models/TaskTester");
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
    include: [
      {
        model: TaskTester,
        as: "assignedTesters",
        required: false,
        attributes: ["id", "uuid", "testerId"],
        include: [
          {
            model: Employee,
            as: "tester",
            required: false,
            attributes: ["id"],
            include: [
              {
                model: User,
                as: "user",
                required: false,
                attributes: ["firstName", "lastName"],
              },
            ],
          },
          {
            model: TaskTesting,
            as: "testingAttempts",
            required: false,
            separate: true,
            attributes: [
              "uuid",
              "attemptNumber",
              "status",
              "testNotes",
              "testedAt",
              "createdAt",
            ],
            order: [["attemptNumber", "DESC"]],
          },
        ],
      },
    ],
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

const getTaskByUuid = async (uuid, options = {}) => {
  const task = await ProjectTask.findOne({
    where: { uuid },
    include: [
      {
        model: TaskTester,
        as: "assignedTesters",
        required: false,
        attributes: ["id", "uuid", "testerId"],
        include: [
          {
            model: Employee,
            as: "tester",
            required: false,
            attributes: ["id"],
            include: [
              {
                model: User,
                as: "user",
                required: false,
                attributes: ["firstName", "lastName"],
              },
            ],
          },
          {
            model: TaskTesting,
            as: "testingAttempts",
            required: false,
            separate: true,
            attributes: [
              "uuid",
              "attemptNumber",
              "status",
              "testNotes",
              "testedAt",
              "createdAt",
            ],
            order: [["attemptNumber", "DESC"]],
          },
        ],
      },
    ],
    ...options,
  });

  if (!task) {
    throw new Error("Task not found");
  }

  return task;
};

const updateTask = async (uuid, body) => {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const task = await getTaskByUuid(uuid, { transaction });
    const values = buildTaskValues(body);

    validateTaskValues({
      title: values.title,
      priority: values.priority,
      status: values.status,
      isBlocked: values.isBlocked,
      blockedReason: values.blockedReason,
      startDate: hasOwn(values, "startDate")
        ? values.startDate
        : task.startDate,
      dueDate: hasOwn(values, "dueDate") ? values.dueDate : task.dueDate,
      estimatedHours: values.estimatedHours,
      actualHours: values.actualHours,
      sortOrder: values.sortOrder,
    });

    const nextModuleId = hasOwn(values, "moduleId")
      ? values.moduleId
      : task.moduleId;

    const nextPhaseId = hasOwn(values, "phaseId")
      ? values.phaseId
      : task.phaseId;

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

    const previousStatus = task.status;
    const nextStatus = hasOwn(values, "status")
      ? values.status
      : previousStatus;

    if (nextStatus === "Done" && previousStatus !== "Done") {
      values.completedAt = new Date();
    } else if (hasOwn(values, "status") && nextStatus !== "Done") {
      values.completedAt = null;
    }

    // Update the task within the transaction.
    await task.update(values, { transaction });

    // Create assignments and testing attempts only on transition to Testing.
    if (nextStatus === "Testing" && previousStatus !== "Testing") {
      const projectOperation = await ProjectOperation.findOne({
        where: { projectId: task.projectId },
        transaction,
      });

      if (projectOperation) {
        const testers = await ProjectOperationTester.findAll({
          where: {
            projectOperationId: projectOperation.id,
          },
          transaction,
        });

        for (const tester of testers) {
          // Find or create this tester's assignment for the task.
          const [assignment] = await TaskTester.findOrCreate({
            where: {
              taskId: task.id,
              testerId: tester.employeeId,
            },
            defaults: {
              taskId: task.id,
              testerId: tester.employeeId,
            },
            transaction,
          });

          // Find the latest attempt for this assignment.
          const latestAttempt = await TaskTesting.findOne({
            where: {
              testTaskTesterId: assignment.id,
            },
            order: [
              ["attemptNumber", "DESC"],
              ["id", "DESC"],
            ],
            transaction,
          });

          // Create attempt 1, or retry if the previous attempt failed.
          if (!latestAttempt || latestAttempt.status === "Failed") {
            await TaskTesting.create(
              {
                projectId: task.projectId,
                taskId: task.id,
                testTaskTesterId: assignment.id,
                attemptNumber: latestAttempt
                  ? latestAttempt.attemptNumber + 1
                  : 1,
                status: "Pending",
              },
              { transaction },
            );
          }
        }
      }
    }

    await transaction.commit();

    return task;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

const deleteTask = async (uuid) => {
  const task = await getTaskByUuid(uuid);

  await task.destroy();

  return task;
};

const getDevelopersAndTesters = async (companyId) => {
  return Employee.findAll({
    where: {
      companyId,
      employmentStatus: {
        [Op.ne]: "Exited",
      },
    },
    attributes: ["id"],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["firstName", "lastName"],
        where: {
          isActive: true,
        },
        include: [
          {
            model: Role,
            as: "role",
            attributes: ["name"],
            where: {
              name: {
                [Op.in]: ["developer", "tester"],
              },
            },
          },
        ],
      },
    ],
    order: [[{ model: User, as: "user" }, "firstName", "ASC"]],
  });
};

const STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Code Review",
  "Testing",
  "Done",
];

async function getMyTasks(userId, companyId) {
  const employeeId = await employeeService.getEmployeeIdByUserId(userId);

  const tasks = await ProjectTask.findAll({
    where: {
      assignedTo: employeeId,
    },
    include: [
      {
        model: Project,
        as: "project",
        where: { companyId },
        attributes: ["id", "uuid", "name"],
        required: true,
      },
      {
        model: ProjectModule,
        as: "module",
        attributes: ["id", "uuid", "name"],
        required: false,
      },
      {
        model: ProjectPhase,
        as: "phase",
        attributes: ["id", "uuid", "name"],
        required: false,
      },
      {
        model: TaskTesting,
        as: "testingRecords",
        attributes: ["uuid", "status", "testNotes", "testedAt", "createdAt"],
        required: false,
      },
    ],
    order: [
      ["sortOrder", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  return tasks;
}

async function updateMyTaskStatus(taskUuid, userId, companyId, status) {
  if (!STATUSES.includes(status)) {
    throw new Error("Invalid task status.");
  }

  const employeeId = await employeeService.getEmployeeIdByUserId(userId);

  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    // 1. Find the task
    const task = await ProjectTask.findOne({
      where: {
        uuid: taskUuid,
        assignedTo: employeeId,
      },
      include: [
        {
          model: Project,
          as: "project",
          where: { companyId },
          attributes: ["id"],
          required: true,
        },
      ],
      transaction,
    });

    if (!task) {
      await transaction.rollback();
      return null;
    }

    // 2. Check authorization before updating anything
    const isLead = await middleware.checkProjectLead(
      userId,
      companyId,
      task.project.id,
    );

    if ((status === "Testing" || status === "Done") && !isLead) {
      throw new Error("Only the project lead can set this task status.");
    }

    const previousStatus = task.status;

    // 3. Update task status
    task.status = status;
    task.completedAt = status === "Done" ? new Date() : null;

    await task.save({ transaction });

    // 4. Create assignments and testing attempts on transition to Testing
    if (status === "Testing" && previousStatus !== "Testing") {
      const projectOperation = await ProjectOperation.findOne({
        where: {
          projectId: task.project.id,
        },
        transaction,
      });

      if (projectOperation) {
        const testers = await ProjectOperationTester.findAll({
          where: {
            projectOperationId: projectOperation.id,
          },
          transaction,
        });

        for (const tester of testers) {
          // Find or create the tester's assignment for this task
          const [assignment] = await TaskTester.findOrCreate({
            where: {
              taskId: task.id,
              testerId: tester.employeeId,
            },
            defaults: {
              taskId: task.id,
              testerId: tester.employeeId,
            },
            transaction,
          });

          // Get the tester's latest attempt
          const latestAttempt = await TaskTesting.findOne({
            where: {
              testTaskTesterId: assignment.id,
            },
            order: [
              ["attemptNumber", "DESC"],
              ["id", "DESC"],
            ],
            transaction,
          });

          // First attempt, or retry after failure
          if (!latestAttempt || latestAttempt.status === "Failed") {
            await TaskTesting.create(
              {
                projectId: task.project.id,
                taskId: task.id,
                testTaskTesterId: assignment.id,
                attemptNumber: latestAttempt
                  ? latestAttempt.attemptNumber + 1
                  : 1,
                status: "Pending",
              },
              { transaction },
            );
          }
        }
      }
    }

    await transaction.commit();

    return task;
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}
module.exports = {
  createTask,
  listProjectTasks,
  listModuleTasks,
  listPhaseTasks,
  getTaskByUuid,
  updateTask,
  deleteTask,
  getDevelopersAndTesters,
  getMyTasks,
  updateMyTaskStatus,
};
