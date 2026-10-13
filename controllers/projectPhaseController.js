const projectPhaseService = require("../services/projectPhaseService");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUSES = ["Not Started", "In Progress", "Completed", "On Hold"];

const isValidUuid = (value) =>
  typeof value === "string" && UUID_REGEX.test(value);

const isValidDate = (value) => {
  if (value === null || value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const validatePhaseData = (body, isUpdate = false) => {
  const { name, description, startDate, endDate, status, sortOrder } = body;

  if (!isUpdate || name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return "Phase name is required.";
    }
  }

  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return "Description must be a string or null.";
  }

  if (startDate !== undefined && !isValidDate(startDate)) {
    return "Start date must be a valid YYYY-MM-DD date or null.";
  }

  if (endDate !== undefined && !isValidDate(endDate)) {
    return "End date must be a valid YYYY-MM-DD date or null.";
  }

  if (status !== undefined && !STATUSES.includes(status)) {
    return "Invalid phase status.";
  }

  if (
    sortOrder !== undefined &&
    (!Number.isInteger(sortOrder) || sortOrder < 0)
  ) {
    return "Sort order must be a non-negative integer.";
  }

  const effectiveStartDate = startDate;
  const effectiveEndDate = endDate;

  if (
    effectiveStartDate &&
    effectiveEndDate &&
    effectiveEndDate < effectiveStartDate
  ) {
    return "End date cannot be before start date.";
  }

  return null;
};

const handleError = (res, error, action) => {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      message: "A phase with this name already exists in this module.",
    });
  }

  if (
    error.name === "SequelizeValidationError" ||
    (error.name === "SequelizeDatabaseError" &&
      error.original?.code === "23514")
  ) {
    return res.status(400).json({
      message:
        error.errors?.map((item) => item.message).join(", ") ||
        "Invalid phase data.",
    });
  }

  console.error(`${action} error:`, error);

  return res.status(500).json({
    message: `Failed to ${action}.`,
  });
};

const createPhase = async (req, res) => {
  try {
    const { projectUuid, moduleUuid } = req.params;

    if (!isValidUuid(projectUuid) || !isValidUuid(moduleUuid)) {
      return res.status(400).json({
        message: "Invalid project or module UUID.",
      });
    }

    const validationError = validatePhaseData(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { name, description, startDate, endDate, status, sortOrder } =
      req.body;

    const result = await projectPhaseService.createPhase(
      projectUuid,
      moduleUuid,
      {
        name,
        description,
        startDate,
        endDate,
        status,
        sortOrder,
      },
    );

    if (result.notFound === "Project") {
      return res.status(404).json({ message: "Project not found." });
    }

    if (result.notFound === "Module") {
      return res.status(404).json({
        message: "Module not found in this project.",
      });
    }

    return res.status(201).json({
      message: "Phase created successfully.",
      data: result.data,
    });
  } catch (error) {
    return handleError(res, error, "create phase");
  }
};

const getPhasesByModule = async (req, res) => {
  try {
    const { projectUuid, moduleUuid } = req.params;

    if (!isValidUuid(projectUuid) || !isValidUuid(moduleUuid)) {
      return res.status(400).json({
        message: "Invalid project or module UUID.",
      });
    }

    const result = await projectPhaseService.getPhasesByModule(
      projectUuid,
      moduleUuid,
    );

    if (result.notFound === "Project") {
      return res.status(404).json({ message: "Project not found." });
    }

    if (result.notFound === "Module") {
      return res.status(404).json({
        message: "Module not found in this project.",
      });
    }

    return res.status(200).json({
      count: result.data.length,
      data: result.data,
    });
  } catch (error) {
    return handleError(res, error, "fetch phases");
  }
};

const getPhase = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid phase UUID." });
    }

    const phase = await projectPhaseService.getPhase(uuid);

    if (!phase) {
      return res.status(404).json({ message: "Phase not found." });
    }

    return res.status(200).json({ data: phase });
  } catch (error) {
    return handleError(res, error, "fetch phase");
  }
};

const updatePhase = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid phase UUID." });
    }

    const validationError = validatePhaseData(req.body, true);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const phase = await projectPhaseService.getPhase(uuid);

    if (!phase) {
      return res.status(404).json({ message: "Phase not found." });
    }

    const startDate = Object.hasOwn(req.body, "startDate")
      ? req.body.startDate
      : phase.startDate;

    const endDate = Object.hasOwn(req.body, "endDate")
      ? req.body.endDate
      : phase.endDate;

    if (
      startDate &&
      endDate &&
      String(endDate).slice(0, 10) < String(startDate).slice(0, 10)
    ) {
      return res.status(400).json({
        message: "End date cannot be before start date.",
      });
    }

    const updates = {};

    for (const field of [
      "name",
      "description",
      "startDate",
      "endDate",
      "status",
      "sortOrder",
    ]) {
      if (Object.hasOwn(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    const updatedPhase = await projectPhaseService.updatePhase(uuid, updates);

    return res.status(200).json({
      message: "Phase updated successfully.",
      data: updatedPhase,
    });
  } catch (error) {
    return handleError(res, error, "update phase");
  }
};

const deletePhase = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!isValidUuid(uuid)) {
      return res.status(400).json({ message: "Invalid phase UUID." });
    }

    const phase = await projectPhaseService.deletePhase(uuid);

    if (!phase) {
      return res.status(404).json({ message: "Phase not found." });
    }

    return res.status(200).json({
      message: "Phase deleted successfully.",
    });
  } catch (error) {
    return handleError(res, error, "delete phase");
  }
};

module.exports = {
  createPhase,
  getPhasesByModule,
  getPhase,
  updatePhase,
  deletePhase,
};
