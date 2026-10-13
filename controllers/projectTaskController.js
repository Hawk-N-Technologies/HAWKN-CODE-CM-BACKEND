const projectTaskService = require("../services/projectTaskService");

const getErrorStatus = (error) => {
  if (error.message === "Task not found") return 404;

  if (
    error.message.includes("not found") ||
    error.message.includes("does not belong")
  ) {
    return 404;
  }

  return 400;
};

const createTask = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId ?? null;

    const data = await projectTaskService.createTask(
      req.params.projectUuid,
      req.body,
      userId,
    );

    return res.status(201).json({
      message: "Task created successfully",
      data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to create task",
    });
  }
};

const listProjectTasks = async (req, res) => {
  try {
    console.log("i am hiiteed");
    const data = await projectTaskService.listProjectTasks(
      req.params.projectUuid,
      req.query,
    );

    return res.status(200).json({
      count: data.length,
      data: data.data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to fetch tasks",
    });
  }
};

const listModuleTasks = async (req, res) => {
  try {
    const data = await projectTaskService.listModuleTasks(
      req.params.projectUuid,
      req.params.moduleUuid,
      req.query,
    );
    console.log(data);
    return res.status(200).json({
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to fetch module tasks",
    });
  }
};

const listPhaseTasks = async (req, res) => {
  try {
    const data = await projectTaskService.listPhaseTasks(
      req.params.projectUuid,
      req.params.moduleUuid,
      req.params.phaseUuid,
      req.query,
    );

    return res.status(200).json({
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to fetch phase tasks",
    });
  }
};

const getTaskByUuid = async (req, res) => {
  try {
    const data = await projectTaskService.getTaskByUuid(req.params.uuid);

    return res.status(200).json({
      message: "Task fetched successfully",
      data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to fetch task",
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const data = await projectTaskService.updateTask(req.params.uuid, req.body);

    return res.status(200).json({
      message: "Task updated successfully",
      data,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to update task",
    });
  }
};

const deleteTask = async (req, res) => {
  try {
    await projectTaskService.deleteTask(req.params.uuid);

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message: error.message || "Failed to delete task",
    });
  }
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
