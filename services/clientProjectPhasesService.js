const {
  Project,
  Client,
  ProjectModule,
  ProjectPhase,
  ProjectTask,
} = require("../models/associations");

const TASK_STATUS_PROGRESS = {
  Backlog: 0,
  "To Do": 0,
  "In Progress": 50,
  "Code Review": 80,
  Testing: 90,
  Done: 100,
};

const dateOnly = (value) =>
  value ? String(value).slice(0, 10) : null;

function getTaskProgress(status) {
  return TASK_STATUS_PROGRESS[status] ?? 0;
}

function calculateProgress(tasks) {
  if (tasks.length === 0) return 0;

  const totalProgress = tasks.reduce(
    (sum, task) => sum + getTaskProgress(task.status),
    0,
  );

  return Math.round(totalProgress / tasks.length);
}

function taskResponse(task) {
  return {
    uuid: task.uuid,
    title: task.title,
    description: task.description,
    assignedTo: task.assignedTo,
    priority: task.priority,
    status: task.status,
    isBlocked: task.isBlocked,
    blockedReason: task.blockedReason,
    startDate: dateOnly(task.startDate),
    dueDate: dateOnly(task.dueDate),
    estimatedHours:
      task.estimatedHours == null
        ? null
        : Number(task.estimatedHours),
    progress: getTaskProgress(task.status),
  };
}

function withProgress(tasks) {
  const mappedTasks = tasks.map(taskResponse);

  const completedTaskCount = mappedTasks.filter(
    (task) => task.status === "Done",
  ).length;

  return {
    tasks: mappedTasks,
    taskCount: mappedTasks.length,
    completedTaskCount,
    progress: calculateProgress(mappedTasks),
  };
}

async function getProjectPhases(userId, companyId, projectUuid) {
  // Resolve the authenticated client's active profile.
  const client = await Client.findOne({
    where: {
      userId,
      companyId,
      isActive: true,
    },
    attributes: ["id"],
  });

  if (!client) {
    const error = new Error(
      "No active client profile is linked to this account.",
    );
    error.statusCode = 404;
    throw error;
  }

  // Restrict access to projects owned by this client and company.
  const project = await Project.findOne({
    where: {
      uuid: projectUuid,
      clientId: client.id,
      companyId,
    },
    attributes: [
      "id",
      "uuid",
      "name",
      "status",
      "progress",
      "startDate",
      "deadline",
    ],
  });

  if (!project) {
    const error = new Error("Project not found.");
    error.statusCode = 404;
    throw error;
  }

  const [modules, ungroupedTasks, allTasks] = await Promise.all([
    ProjectModule.findAll({
      where: {
        projectId: project.id,
      },
      include: [
        {
          model: ProjectPhase,
          as: "phases",
          required: false,
        },
      ],
      order: [
        ["sortOrder", "ASC"],
        ["id", "ASC"],
      ],
    }),

    ProjectTask.findAll({
      where: {
        projectId: project.id,
        moduleId: null,
      },
      order: [
        ["sortOrder", "ASC"],
        ["id", "ASC"],
      ],
    }),

    ProjectTask.findAll({
      where: {
        projectId: project.id,
      },
      order: [
        ["sortOrder", "ASC"],
        ["id", "ASC"],
      ],
    }),
  ]);

  const moduleRows = await Promise.all(
    modules.map(async (module) => {
      const [moduleTasks, phases] = await Promise.all([
        ProjectTask.findAll({
          where: {
            projectId: project.id,
            moduleId: module.id,
          },
          order: [
            ["sortOrder", "ASC"],
            ["id", "ASC"],
          ],
        }),

        Promise.all(
          (module.phases || []).map(async (phase) => {
            const phaseTasks = await ProjectTask.findAll({
              where: {
                projectId: project.id,
                phaseId: phase.id,
              },
              order: [
                ["sortOrder", "ASC"],
                ["id", "ASC"],
              ],
            });

            return {
              uuid: phase.uuid,
              name: phase.name,
              description: phase.description,
              startDate: dateOnly(phase.startDate),
              endDate: dateOnly(phase.endDate),
              status: phase.status,
              sortOrder: phase.sortOrder,
              ...withProgress(phaseTasks),
            };
          }),
        ),
      ]);

      return {
        uuid: module.uuid,
        name: module.name,
        description: module.description,
        priority: module.priority,
        status: module.status,
        sortOrder: module.sortOrder,
        ...withProgress(moduleTasks),
        phases,
      };
    }),
  );

  const projectTaskSummary = withProgress(allTasks);

  return {
    project: {
      uuid: project.uuid,
      name: project.name,
      status: project.status,
      startDate: dateOnly(project.startDate),
      deadline: dateOnly(project.deadline),

      // Preserve the existing project's authoritative progress value.
      progress: Number(project.progress) || 0,

      // Task statistics are separate from the stored project percentage.
      taskCount: projectTaskSummary.taskCount,
      completedTaskCount: projectTaskSummary.completedTaskCount,
    },

    modules: moduleRows,

    // Tasks not assigned to any module remain visible.
    ungroupedTasks: ungroupedTasks.map(taskResponse),
  };
}

module.exports = {
  getProjectPhases,
};
