"use strict";

const { Op } = require("@sequelize/core");

const Project = require("../models/Project");
const ProjectTask = require("../models/ProjectTask");
const ProjectTaskDeveloper = require("../models/ProjectTaskDeveloper");
const DeveloperTaskTesting = require("../models/DeveloperTaskTesting");
const Employee = require("../models/Employee");
const employeeService = require("../services/employeeService");

const VALID_RESULTS = ["Pending", "Passed", "Failed"];

async function getDeveloperContext(userId, companyId) {
  const developerId = await employeeService.getEmployeeIdByUserId(userId);

  const employee = await Employee.findOne({
    where: {
      id: developerId,
      companyId,
    },
    attributes: ["id", "companyId"],
  });

  if (!employee) {
    const error = new Error("Developer employee record not found.");
    error.statusCode = 403;
    throw error;
  }

  return developerId;
}

async function getAssignedTask(taskUuid, developerId, companyId) {
  const task = await ProjectTask.findOne({
    where: { uuid: taskUuid },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        where: { companyId },
        attributes: ["id", "uuid", "name", "companyId"],
      },
    ],
  });

  if (!task) {
    const error = new Error("Task not found in your company.");
    error.statusCode = 404;
    throw error;
  }

  const assignment = await ProjectTaskDeveloper.findOne({
    where: {
      taskId: task.id,
      employeeId: developerId,
    },
  });

  if (!assignment) {
    const error = new Error("You are not assigned to this task.");
    error.statusCode = 403;
    throw error;
  }

  return task;
}

async function getMyTestingRecords(userId, companyId) {
  const developerId = await getDeveloperContext(userId, companyId);

  const assignments = await ProjectTaskDeveloper.findAll({
    where: { employeeId: developerId },
    attributes: ["taskId"],
  });

  const taskIds = assignments.map((assignment) => assignment.taskId);

  if (taskIds.length === 0) {
    return [];
  }

  const tasks = await ProjectTask.findAll({
    where: {
      id: { [Op.in]: taskIds },
    },
    include: [
      {
        model: Project,
        as: "project",
        required: true,
        where: { companyId },
        attributes: ["uuid", "name"],
      },
    ],
    order: [["updatedAt", "DESC"]],
  });

  const records = await DeveloperTaskTesting.findAll({
    where: {
      developerId,
      taskId: { [Op.in]: tasks.map((task) => task.id) },
    },
  });

  const recordsByTask = new Map(
    records.map((record) => [record.taskId, record]),
  );

  return tasks.map((task) => {
    const record = recordsByTask.get(task.id);

    return {
      taskUuid: task.uuid,
      taskTitle: task.title,
      taskStatus: task.status,
      project: task.project?.name ?? "Project",
      result: record?.result ?? "Pending",
      notes: record?.notes ?? "",
      testingUuid: record?.uuid ?? null,
      testedAt: record?.testedAt ?? null,
      updatedAt: record?.updatedAt ?? null,
    };
  });
}

async function saveTestingResult(
  taskUuid,
  userId,
  companyId,
  { result, notes },
) {
  if (!VALID_RESULTS.includes(result)) {
    const error = new Error("Invalid testing result.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof notes !== "string") {
    notes = "";
  }

  if (result === "Failed" && !notes.trim()) {
    const error = new Error("Testing notes are required for a failed result.");
    error.statusCode = 400;
    throw error;
  }

  const developerId = await getDeveloperContext(userId, companyId);
  const task = await getAssignedTask(taskUuid, developerId, companyId);

  const [record, created] = await DeveloperTaskTesting.findOrCreate({
    where: {
      taskId: task.id,
      developerId,
    },
    defaults: {
      taskId: task.id,
      developerId,
      result,
      notes: notes.trim() || null,
      testedAt: result === "Pending" ? null : new Date(),
    },
  });

  if (!created) {
    record.result = result;
    record.notes = notes.trim() || null;
    record.testedAt = result === "Pending" ? null : new Date();
    await record.save();
  }

  return {
    taskUuid: task.uuid,
    taskTitle: task.title,
    result: record.result,
    notes: record.notes ?? "",
    testingUuid: record.uuid,
    testedAt: record.testedAt,
    updatedAt: record.updatedAt,
  };
}

module.exports = {
  getMyTestingRecords,
  saveTestingResult,
};