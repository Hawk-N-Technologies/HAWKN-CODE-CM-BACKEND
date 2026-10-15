const express = require("express");

const employeeController = require("../controllers/employeeController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { createEmployeeSchema } = require("../validations/employee.validation");

const router = express.Router();

router.get(
  "/roles",
  authenticate(["hr", "admin"]),
  employeeController.getRoles,
);

router.get("/", authenticate(["hr"]), employeeController.getEmployees);
router.get("/getPeople", authenticate(["admin"]), employeeController.getPeople);
router.get("/:id", authenticate(["hr"]), employeeController.getEmployee);
router.post(
  "/create",
  authenticate(["admin"]),
  employeeController.createPerson,
);
router.post(
  "/",
  authenticate(["hr"]),
  validate(createEmployeeSchema),
  employeeController.createEmployee,
);
router.put(
  "/people/:id",
  authenticate(["admin"]),
  employeeController.updatePerson,
);

// Update employee
router.put("/:id", authenticate(["hr"]), employeeController.updateEmployee);

// Delete employee
router.delete("/:id", authenticate(["hr"]), employeeController.deleteEmployee);

module.exports = router;
