const { Op } = require("@sequelize/core");

const sequelize = require("../config/db");
const Project = require("../models/Project");
const ProjectTask = require("../models/ProjectTask");
const ProjectModule = require("../models/ProjectModule");
const ProjectPhase = require("../models/ProjectPhase");
const Employee = require("../models/Employee");
const User = require("../models/User");
const TaskTesting = require("../models/TaskTesting");
const employeeService = require("../services/employeeService");
const TaskTester = require("../models/TaskTester");

const TEST_STATUSES = ["Pending", "In Progress", "Passed", "Failed"];
const getTestingQueue = async (userId, companyId, filters = {}) => {
  const testerId = await employeeService.getEmployeeIdByUserId(userId);

  if (!testerId) {
    throw new Error("Tester employee record not found");
  }

  const where = {};

  if (filters.status && filters.status !== "All statuses") {
    if (!TEST_STATUSES.includes(filters.status)) {
      throw new Error("Invalid test status filter");
    }

    where.status = filters.status;
  }

  const search = filters.search?.trim();

  const records = await TaskTesting.findAll({
    where,
    include: [
      {
        model: TaskTester,
        as: "testerAssignment",
        required: true,
        where: { testerId },
        attributes: ["id", "uuid", "taskId", "testerId"],
        include: [
          {
            model: Employee,
            as: "tester",
            required: true,
            attributes: ["id"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["firstName", "lastName"],
                required: false,
              },
            ],
          },
        ],
      },
      {
        model: ProjectTask,
        as: "task",
        required: true,
        where: search ? { title: { [Op.iLike]: `%${search}%` } } : {},
        attributes: [
          "id",
          "uuid",
          "title",
          "description",
          "status",
          "priority",
          "dueDate",
          "completedAt",
        ],
        include: [
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
        ],
      },
      {
        model: Project,
        as: "project",
        required: true,
        where: {
          companyId,
          ...(search ? { name: { [Op.iLike]: `%${search}%` } } : {}),
        },
        attributes: ["id", "uuid", "name", "companyId"],
      },
    ],
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  if (!search) {
    return records;
  }

  const normalizedSearch = search.toLowerCase();

  return records.filter((record) => {
    const values = [
      record.task?.title,
      record.task?.module?.name,
      record.task?.phase?.name,
      record.project?.name,
      record.testerAssignment?.tester?.user?.firstName,
      record.testerAssignment?.tester?.user?.lastName,
    ];

    return values.some((value) =>
      value?.toLowerCase().includes(normalizedSearch),
    );
  });
};
const updateTestingStatus = async (
  testingUuid,
  userId,
  companyId,
  { status, testNotes },
) => {
  if (!TEST_STATUSES.includes(status)) {
    throw new Error("Invalid testing status");
  }

  if (status === "Failed" && !testNotes?.trim()) {
    throw new Error("Test notes are required when a test fails");
  }

  const testerId = await employeeService.getEmployeeIdByUserId(userId);

  if (!testerId) {
    throw new Error("Tester employee record not found");
  }

  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    const testing = await TaskTesting.findOne({
      where: { uuid: testingUuid },
      include: [
        {
          model: TaskTester,
          as: "testerAssignment",
          where: { testerId },
          required: true,
          attributes: ["id", "taskId", "testerId"],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!testing) {
      const error = new Error("Testing assignment not found");
      error.statusCode = 404;
      throw error;
    }

    const task = await ProjectTask.findOne({
      where: {
        id: testing.taskId,
        projectId: testing.projectId,
      },
      include: [
        {
          model: Project,
          as: "project",
          where: { companyId },
          attributes: ["id", "uuid", "name"],
          required: true,
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!task) {
      const error = new Error("Task not found in your company");
      error.statusCode = 404;
      throw error;
    }

    if (["Passed", "Failed"].includes(testing.status)) {
      const error = new Error(
        "This test attempt is finalized. Create a new attempt to retest.",
      );
      error.statusCode = 409;
      throw error;
    }

    testing.status = status;
    testing.testNotes = testNotes?.trim() || null;
    testing.testedAt = ["Passed", "Failed"].includes(status)
      ? new Date()
      : null;

    await testing.save({ transaction });

    if (status === "Failed") {
      task.status = "In Progress";
      task.completedAt = null;
      await task.save({ transaction });
    }

    if (status === "Passed") {
      task.status = "Done";
      task.completedAt = new Date();
      task.isBlocked = false;
      task.blockedReason = null;
      await task.save({ transaction });
    }

    await transaction.commit();

    return { testing, task };
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
};

module.exports = {
  getTestingQueue,
  updateTestingStatus,
};
