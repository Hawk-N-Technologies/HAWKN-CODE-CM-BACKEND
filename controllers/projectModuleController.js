// controllers/projectModule.controller.js

const projectModuleService = require("../services/projectModuleService");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (uuid) => typeof uuid === "string" && UUID_REGEX.test(uuid);

const handleError = (res, error, action) => {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      message: "A module with this name already exists in this project.",
    });
  }

  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      message: error.errors.map((item) => item.message).join(", "),
    });
  }

  console.error(`${action} error:`, error);

  return res.status(500).json({
    message: `Failed to ${action}.`,
  });
};

const createModule = async (req, res) => {
  try {
    const { projectUuid } = req.params;
    const { name, description, priority, status, sortOrder } = req.body;

    if (!isValidUuid(projectUuid)) {
      return res.status(400).json({ message: "Invalid project UUID." });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Module name is required." });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be a string or null.",
      });
    }

    if (
      priority !== undefined &&
      !["Low", "Medium", "High", "Critical"].includes(priority)
    ) {
      return res.status(400).json({ message: "Invalid module priority." });
    }

    if (
      status !== undefined &&
      !["Not Started", "In Progress", "Completed", "On Hold"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid module status." });
    }

    if (
      sortOrder !== undefined &&
      (!Number.isInteger(sortOrder) || sortOrder < 0)
    ) {
      return res.status(400).json({
        message: "Sort order must be a non-negative integer.",
      });
    }

    const result = await projectModuleService.createModule(projectUuid, {
      name,
      description,
      priority,
      status,
      sortOrder,
    });

    if (result.notFound) {
      return res.status(404).json({ message: "Project not found." });
    }

    return res.status(201).json({
      message: "Module created successfully.",
      data: result.data,
    });
  } catch (error) {
    return handleError(res, error, "create module");
  }
};

const getModulesByProject = async (req, res) => {
  try {
    const { projectUuid } = req.params;

    if (!isValidUuid(projectUuid)) {
      return res.status(400).json({ message: "Invalid project UUID." });
    }

    const result = await projectModuleService.getModulesByProject(projectUuid);

    if (result.notFound) {
      return res.status(404).json({ message: "Project not found." });
    }

    return res.status(200).json({
      count: result.data.length,
      data: result.data,
    });
  } catch (error) {
    return handleError(res, error, "fetch modules");
  }
};

const getModule = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid module UUID." });
    }

    const module = await projectModuleService.getModule(uuid);

    if (!module) {
      return res.status(404).json({ message: "Module not found." });
    }

    return res.status(200).json({ data: module });
  } catch (error) {
    return handleError(res, error, "fetch module");
  }
};

const updateModule = async (req, res) => {
  try {
    const { uuid } = req.params;
    const { name, description, priority, status, sortOrder } = req.body;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid module UUID." });
    }

    const updates = {
      name,
      description,
      priority,
      status,
      sortOrder,
    };

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        message: "Module name must be a non-empty string.",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        message: "Description must be a string or null.",
      });
    }

    if (
      priority !== undefined &&
      !["Low", "Medium", "High", "Critical"].includes(priority)
    ) {
      return res.status(400).json({ message: "Invalid module priority." });
    }

    if (
      status !== undefined &&
      !["Not Started", "In Progress", "Completed", "On Hold"].includes(status)
    ) {
      return res.status(400).json({ message: "Invalid module status." });
    }

    if (
      sortOrder !== undefined &&
      (!Number.isInteger(sortOrder) || sortOrder < 0)
    ) {
      return res.status(400).json({
        message: "Sort order must be a non-negative integer.",
      });
    }

    const module = await projectModuleService.updateModule(uuid, updates);

    if (!module) {
      return res.status(404).json({ message: "Module not found." });
    }

    return res.status(200).json({
      message: "Module updated successfully.",
      data: module,
    });
  } catch (error) {
    return handleError(res, error, "update module");
  }
};

const deleteModule = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid module UUID." });
    }

    const module = await projectModuleService.deleteModule(uuid);

    if (!module) {
      return res.status(404).json({ message: "Module not found." });
    }

    return res.status(200).json({
      message: "Module deleted successfully.",
    });
  } catch (error) {
    return handleError(res, error, "delete module");
  }
};

module.exports = {
  createModule,
  getModulesByProject,
  getModule,
  updateModule,
  deleteModule,
};
