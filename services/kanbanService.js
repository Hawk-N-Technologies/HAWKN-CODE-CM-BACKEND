const { Op } = require("@sequelize/core");
const Project = require("../models/Project");
const ProjectTask = require("../models/ProjectTask");
const ProjectModule = require("../models/ProjectModule");
const ProjectPhase = require("../models/ProjectPhase");
const Employee = require("../models/Employee");
const TaskTesting = require("../models/TaskTesting");
const ProjectOperation = require("../models/ProjectOperation");
const sequelize = require("../config/db");
const User = require("../models/User");
const TaskTester = require("../models/TaskTester");
const middleware = require("../middleware/requireProjectLead");
const TASK_STATUSES = [
  "Backlog",
  "To Do",
  "In Progress",
  "Code Review",
  "Testing",
  "Done",
];

const TEST_STATUSES = ["Pending", "In Progress", "Passed", "Failed"];
const EDITOR_ROLES = ["admin", "developer"];
const ALL_BOARD_ROLES = ["admin", "developer", "tester"];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRole(user) {
  const role = user?.role;

  if (typeof role === "string") {
    return role.toLowerCase();
  }

  return String(
    role?.name || user?.roleName || user?.role_name || "",
  ).toLowerCase();
}

function getUserId(user) {
  return user?.id ?? user?.userId ?? user?.user_id ?? null;
}

async function getEmployeeForUser(user) {
  try {
    const userId = getUserId(user);

    if (!userId) {
      return null;
    }

    return await Employee.findOne({
      where: { userId },
    });
  } catch (error) {
    throw error;
  }
}

async function getProject(companyId, projectUuid, transaction) {
  try {
    if (!companyId) {
      throw httpError("Company ID is required", 400);
    }

    if (!projectUuid) {
      throw httpError("Project UUID is required", 400);
    }

    const project = await Project.findOne({
      where: { uuid: projectUuid, companyId },
      transaction,
    });

    if (!project) {
      throw httpError("Project not found", 404);
    }

    return project;
  } catch (error) {
    throw error;
  }
}

function formatEmployee(employee) {
  if (!employee) {
    return null;
  }

  const user = employee.user;

  return {
    uuid: employee.uuid,
    id: employee.id,
    fullName:
      [user?.firstName || user?.first_name, user?.lastName || user?.last_name]
        .filter(Boolean)
        .join(" ") || "Employee",
  };
}

function formatTesting(record) {
  if (!record) {
    return null;
  }

  return {
    uuid: record.uuid,
    status: record.status,
    testNotes: record.testNotes,
    testedAt: record.testedAt,
    createdAt: record.createdAt,
    tester: formatEmployee(record.tester),
  };
}

function formatTask(task, employeesById) {
  const employee = task.assignedTo ? employeesById.get(task.assignedTo) : null;

  const records = [...(task.testingRecords || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const latestTesting = records[0] || null;

  return {
    uuid: task.uuid,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    isBlocked: task.isBlocked,
    blockedReason: task.blockedReason,
    startDate: task.startDate,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    estimatedHours: task.estimatedHours,
    actualHours: task.actualHours,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    module: task.module
      ? { uuid: task.module.uuid, name: task.module.name }
      : null,
    phase: task.phase ? { uuid: task.phase.uuid, name: task.phase.name } : null,
    assignee: formatEmployee(employee),
    latestTesting: formatTesting(latestTesting),
    testingHistory: records.map(formatTesting),
  };
}

async function getBoard(companyId, projectUuid) {
  try {
    const project = await getProject(companyId, projectUuid);

    const tasks = await ProjectTask.findAll({
      where: { projectId: project.id },
      include: [
        {
          model: ProjectModule,
          as: "module",
          required: false,
        },
        {
          model: ProjectPhase,
          as: "phase",
          required: false,
        },
        {
          model: TaskTesting,
          as: "testingRecords",
          required: false,
          include: [
            {
              model: TaskTester,
              as: "testerAssignment",
              required: false,
              include: [
                {
                  model: Employee,
                  as: "tester",
                  required: false,
                  include: [
                    {
                      model: User,
                      as: "user",
                      required: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    const employeeIds = [
      ...new Set(tasks.map((task) => task.assignedTo).filter(Boolean)),
    ];

    const employees = employeeIds.length
      ? await Employee.findAll({
          where: {
            id: { [Op.in]: employeeIds },
            companyId,
          },
          include: [{ model: User, as: "user", required: false }],
        })
      : [];

    const employeesById = new Map(
      employees.map((employee) => [employee.id, employee]),
    );

    const formattedTasks = tasks.map((task) => formatTask(task, employeesById));

    const columns = TASK_STATUSES.map((status) => ({
      status,
      count: formattedTasks.filter((task) => task.status === status).length,
      tasks: formattedTasks.filter((task) => task.status === status),
    }));

    return {
      project: {
        uuid: project.uuid,
        name: project.name,
        status: project.status,
        progress: project.progress,
      },
      columns,
      tasks: formattedTasks,
      count: formattedTasks.length,
      stats: {
        total: formattedTasks.length,
        completed: formattedTasks.filter((task) => task.status === "Done")
          .length,
        blocked: formattedTasks.filter((task) => task.isBlocked).length,
        active: formattedTasks.filter((task) =>
          ["In Progress", "Code Review", "Testing"].includes(task.status),
        ).length,
      },
    };
  } catch (error) {
    throw error;
  }
}

async function findTaskInCompany(companyId, taskUuid, transaction) {
  try {
    if (!taskUuid) {
      throw httpError("Task UUID is required", 400);
    }

    const task = await ProjectTask.findOne({
      where: { uuid: taskUuid },
      include: [
        {
          model: Project,
          as: "project",
          required: true,
          where: { companyId },
        },
      ],
      transaction,
    });

    if (!task) {
      throw httpError("Task not found", 404);
    }

    return task;
  } catch (error) {
    throw error;
  }
}

async function ensureDeveloperOwnsTask(user, task) {
  try {
    const employee = await getEmployeeForUser(user);

    if (!employee || employee.id !== task.assignedTo) {
      throw httpError("You can update only tasks assigned to you", 403);
    }
  } catch (error) {
    throw error;
  }
}

async function resolveTester(companyId, testerUuid, projectId, transaction) {
  try {
    if (!testerUuid) {
      throw httpError(
        "testerUuid is required when moving a task to Testing",
        400,
      );
    }

    const tester = await Employee.findOne({
      where: {
        uuid: testerUuid,
        companyId,
        employmentStatus: { [Op.ne]: "Exited" },
      },
      transaction,
    });

    if (!tester) {
      throw httpError("Select an active tester from this company", 400);
    }

    const operation = await ProjectOperation.findOne({
      where: { projectId },
      include: [
        {
          model: Employee,
          as: "testers",
          where: { id: tester.id },
          required: false,
        },
      ],
      transaction,
    });

    const primaryOperation = operation
      ? await ProjectOperation.findOne({
          where: { projectId },
          transaction,
        })
      : null;

    const primaryTesterMatches = primaryOperation?.testerId === tester.id;

    const teamTesterMatches = Boolean(
      operation?.testers?.some((item) => item.id === tester.id),
    );

    if (!primaryTesterMatches && !teamTesterMatches) {
      throw httpError(
        "This employee is not assigned as a tester for this project",
        400,
      );
    }

    return tester;
  } catch (error) {
    throw error;
  }
}
async function updateTaskStatus(
  companyId,
  taskUuid,
  nextStatus,
  actor,
  testerUuid,
) {
  if (!TASK_STATUSES.includes(nextStatus)) {
    throw httpError(
      `Invalid status. Allowed statuses: ${TASK_STATUSES.join(", ")}`,
      400,
    );
  }

  const role = normalizeRole(actor);

  if (!ALL_BOARD_ROLES.includes(role)) {
    throw httpError("You are not allowed to update tasks", 403);
  }

  return sequelize.transaction(async (transaction) => {
    const task = await findTaskInCompany(companyId, taskUuid, transaction);

    const currentStatus = task.status;

    // Done is a permanent terminal status.
    if (currentStatus === "Done") {
      throw httpError("Completed tasks cannot be changed or reverted", 409);
    }

    if (currentStatus === nextStatus) {
      throw httpError("Task is already in that status", 409);
    }

    const isLead = await middleware.checkProjectLead(
      actor.userId,
      companyId,
      task.projectId,
    );

    // Forward transitions allowed for developers.
    const forwardTransitions = {
      Backlog: ["To Do"],
      "To Do": ["In Progress"],
      "In Progress": ["Code Review"],
      "Code Review": ["Testing"],
      Testing: ["Done"],
    };

    // Reverting to any earlier workflow stage is allowed,
    // except from Done, which is permanently locked.
    const workflow = [
      "Backlog",
      "To Do",
      "In Progress",
      "Code Review",
      "Testing",
      "Done",
    ];

    const currentIndex = workflow.indexOf(currentStatus);
    const nextIndex = workflow.indexOf(nextStatus);

    if (currentIndex === -1 || nextIndex === -1) {
      throw httpError("Invalid task workflow status", 400);
    }

    const isRevert = nextIndex < currentIndex;
    const isForward = forwardTransitions[currentStatus]?.includes(nextStatus);

    if (!isRevert && !isForward) {
      throw httpError(
        `Transition from "${currentStatus}" to "${nextStatus}" is not allowed`,
        409,
      );
    }

    // Reverts are allowed only to authorized board users.
    // Restrict them to leads/admins if your policy requires it.
    if (isRevert) {
      if (!isLead && !EDITOR_ROLES.includes(role)) {
        throw httpError(
          "Only authorized project members can revert tasks",
          403,
        );
      }
    } else {
      // Only a lead can move a task from Code Review to Testing.
      if (currentStatus === "Code Review" && nextStatus === "Testing") {
        if (!isLead) {
          throw httpError(
            "Only a project lead can send a task to Testing",
            403,
          );
        }
      }

      // Only the assigned tester can complete a task.
      if (currentStatus === "Testing" && nextStatus === "Done") {
        const testing = await TaskTesting.findOne({
          where: {
            taskId: task.id,
            status: "Passed",
          },
          order: [["createdAt", "DESC"]],
          transaction,
        });

        if (!testing) {
          throw httpError(
            "A task can be completed only after passing testing",
            409,
          );
        }

        if (String(testing.testerId) !== String(actor.userId)) {
          throw httpError(
            "Only the assigned tester can mark a task as Done",
            403,
          );
        }
      }

      // Developers must own tasks they work on, unless their
      // role grants broader editing permissions.
      if (
        ["To Do", "In Progress"].includes(currentStatus) &&
        !EDITOR_ROLES.includes(role)
      ) {
        await ensureDeveloperOwnsTask(actor, task);
      }
    }

    // Create a testing record when entering Testing.
    if (nextStatus === "Testing") {
      const tester = await resolveTester(
        companyId,
        testerUuid,
        task.projectId,
        transaction,
      );

      await TaskTesting.create(
        {
          projectId: task.projectId,
          taskId: task.id,
          testerId: tester.id,
          status: "Pending",
        },
        { transaction },
      );
    }

    await task.update(
      {
        status: nextStatus,
        ...(nextStatus !== "Done" ? { completedAt: null } : {}),
        ...(nextStatus === "Done" ? { completedAt: new Date() } : {}),
      },
      { transaction },
    );

    return {
      taskUuid: task.uuid,
      previousStatus: currentStatus,
      status: nextStatus,
    };
  });
}

async function updateTestingResult(
  companyId,
  testingUuid,
  status,
  testNotes,
  actor,
) {
  try {
    if (!["In Progress", "Passed", "Failed"].includes(status)) {
      throw httpError(
        "Testing status must be In Progress, Passed, or Failed",
        400,
      );
    }

    const role = normalizeRole(actor);

    if (!["admin", "project_lead", "tester"].includes(role)) {
      throw httpError("You are not allowed to submit testing results", 403);
    }

    return await sequelize.transaction(async (transaction) => {
      const record = await TaskTesting.findOne({
        where: { uuid: testingUuid, projectId: { [Op.not]: null } },
        transaction,
      });

      if (!record) {
        throw httpError("Testing record not found", 404);
      }

      const project = await Project.findOne({
        where: { id: record.projectId, companyId },
        transaction,
      });

      if (!project) {
        throw httpError("Testing record not found", 404);
      }

      const task = await ProjectTask.findOne({
        where: { id: record.taskId, projectId: project.id },
        transaction,
      });

      if (!task) {
        throw httpError("Task not found", 404);
      }

      if (task.status !== "Testing") {
        throw httpError(
          "Only tasks currently in Testing can receive a test result",
          409,
        );
      }

      if (role === "tester") {
        const employee = await getEmployeeForUser(actor);

        if (!employee || employee.id !== record.testerId) {
          throw httpError(
            "You can submit results only for testing assigned to you",
            403,
          );
        }
      }

      await record.update(
        {
          status,
          testNotes: testNotes?.trim() || null,
          testedAt:
            status === "Passed" || status === "Failed" ? new Date() : null,
        },
        { transaction },
      );

      if (status === "Passed") {
        await task.update(
          { status: "Done", completedAt: new Date() },
          { transaction },
        );
      } else if (status === "Failed") {
        await task.update(
          { status: "In Progress", completedAt: null },
          { transaction },
        );
      }

      return {
        testingUuid: record.uuid,
        taskUuid: task.uuid,
        testingStatus: status,
        taskStatus:
          status === "Passed"
            ? "Done"
            : status === "Failed"
              ? "In Progress"
              : "Testing",
      };
    });
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getBoard,
  updateTaskStatus,
  updateTestingResult,
  TASK_STATUSES,
  TEST_STATUSES,
};
