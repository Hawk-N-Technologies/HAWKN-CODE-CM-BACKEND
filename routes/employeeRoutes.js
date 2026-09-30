const express = require("express");

const employeeController = require("../controllers/employeeController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Get all active roles for employee form
router.get("/roles", authenticate(["hr"]), employeeController.getRoles);

// Get all employees
router.get("/", authenticate(["hr"]), employeeController.getEmployees);

// Get single employee
router.get("/:id", authenticate(["hr"]), employeeController.getEmployee);

// Create employee
router.post("/", authenticate(["hr"]), employeeController.createEmployee);

// Update employee
router.put("/:id", authenticate(["hr"]), employeeController.updateEmployee);

// Delete employee
router.delete("/:id", authenticate(["hr"]), employeeController.deleteEmployee);

module.exports = router;
