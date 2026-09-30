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

module.exports = {
  getEmployees,
  getEmployee,
  getRoles,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
