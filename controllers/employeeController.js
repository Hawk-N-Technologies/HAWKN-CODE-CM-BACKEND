const employeeService = require("../services/employeeService");

const getEmployees = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const employees = await employeeService.getAllEmployees(companyId);

    return res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Get employees error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employees.",
    });
  }
};

const getEmployee = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const employee = await employeeService.getEmployeeById(id, companyId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Get employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee.",
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await employeeService.getAllRoles();

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error("Get roles error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch roles.",
    });
  }
};

const createEmployee = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    console.log(req.body);

    const employee = await employeeService.createEmployee(req.body, companyId);

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      data: employee,
    });
  } catch (error) {
    console.error("Create employee error:", error);

    if (
      error.message === "Invalid or inactive role." ||
      error.message === "A user with this email already exists."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create employee.",
    });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const employee = await employeeService.updateEmployee(
      id,
      companyId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully.",
      data: employee,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    if (
      error.message === "Employee not found." ||
      error.message === "Invalid or inactive role."
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update employee.",
    });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;

    await employeeService.deleteEmployee(id, companyId);

    return res.status(200).json({
      success: true,
      message: "Employee deleted successfully.",
    });
  } catch (error) {
    console.error("Delete employee error:", error);

    if (error.message === "Employee not found.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete employee.",
    });
  }
};

async function getPeople(req, res) {
  try {
    const companyId = req.user.companyId;

    const { search, page = 1, limit = 10, status, role } = req.query;

    const result = await employeeService.getPeople(companyId, {
      search,
      page: Number(page),
      limit: Number(limit),
      status,
      role,
    });

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: result.pagination,
    });
  } catch (error) {
    req.logger?.error?.("Failed to fetch people", {
      error: error.message,
      stack: error.stack,
    });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch people",
    });
  }
}

async function createPerson(req, res) {
  try {
    const companyId = req.user.companyId;

    console.log(req.body);
    return;
    const person = await employeeService.createPerson(req.body, companyId);

    return res.status(201).json({
      success: true,
      message: "Person created successfully.",
      data: person,
    });
  } catch (error) {
    console.error("Create person error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create person.",
    });
  }
}

async function updatePerson(req, res) {
  try {
    const companyId = req.user.companyId;
    const personId = req.params.id;
    console.log(req.params);
    const person = await employeeService.updatePerson(
      req.body,
      personId,
      companyId,
    );

    return res.status(200).json({
      success: true,
      message: "Person updated successfully.",
      data: person,
    });
  } catch (error) {
    console.error("Update person error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update person.",
    });
  }
}

module.exports = {
  getEmployees,
  getEmployee,
  getRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getPeople,
  createPerson,
  updatePerson,
};
