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
    const statusCode = getErrorStatus(error);

    return res.status(statusCode).json({
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

const getDevelopersAndTesters = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        message: "Company information not found",
      });
    }
    console.log(req.user);
    console.log(" i am dlkjldjflkdj ojd;lkfj sd;lkfj;sdlk jf;lksd j;lsdkfj");
    const employees =
      await projectTaskService.getDevelopersAndTesters(companyId);
    return res.status(200).json({
      message: "Employees fetched successfully",
      count: employees.length,
      data: employees.map((employee) => ({
        id: employee.id,
        firstName: employee.user.firstName,
        lastName: employee.user.lastName,
        role: employee.user.role.name,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch employees:", error);

    return res.status(500).json({
      message: "Failed to fetch employees",
    });
  }
};

const getMyTasks = async (req, res) => {
  try {
    const tasks = await projectTaskService.getMyTasks(
      req.user.userId,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error("Get developer tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch developer tasks.",
    });
  }
};

const updateMyTaskStatus = async (req, res) => {
  try {
    const { taskUuid } = req.params;
    const { status } = req.body;

    const task = await projectTaskService.updateMyTaskStatus(
      taskUuid,
      req.user.userId,
      req.user.companyId,
      status,
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found or not assigned to you.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully.",
      data: task,
    });
  } catch (error) {
    console.error("Update developer task status error:", error);

    if (error.message === "Invalid task status.") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message === "Employee record not found for this user.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update task status.",
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
  getDevelopersAndTesters,
  getMyTasks,
  updateMyTaskStatus,
};
