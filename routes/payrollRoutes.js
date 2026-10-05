const express = require("express");

const payrollController = require("../controllers/payrollController");
const employeeSalaryController = require("../controllers/employeeSalaryController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  createPayrollSchema,
  updatePayrollSchema,
  listPayrollQuerySchema,
  searchEmployeesQuerySchema,
  setSalarySchema,
  listSalariesQuerySchema,
} = require("../validations/payroll.validation");

const router = express.Router();

// Payroll is HR-only
router.use(authenticate(["hr"]));

// ---------- Salary Structure (keep ABOVE "/:uuid" routes) ----------

// Autocomplete — only people with an employee record
router.get(
  "/salaries/employees/search",
  validateQuery(searchEmployeesQuerySchema),
  employeeSalaryController.searchEmployees,
);

// List: ?userUuid= (optional, exact employee)
router.get(
  "/salaries",
  validateQuery(listSalariesQuerySchema),
  employeeSalaryController.listSalaries,
);

// Set / update one employee's salary
router.put(
  "/salaries",
  validate(setSalarySchema),
  employeeSalaryController.setSalary,
);

// ---------- Payroll runs ----------

// Name autocomplete (each suggestion includes salary for auto-fill)
router.get(
  "/employees/search",
  validateQuery(searchEmployeesQuerySchema),
  payrollController.searchEmployees,
);

// List with filters: ?startDate=&endDate=&userUuid=&status=
router.get(
  "/",
  validateQuery(listPayrollQuerySchema),
  payrollController.listPayroll,
);

// Create (net salary is calculated by the server)
router.post(
  "/",
  validate(createPayrollSchema),
  payrollController.createPayroll,
);

// Edit a Pending payroll (amounts + payment method only)
router.put("/:uuid", validate(updatePayrollSchema), payrollController.updatePayroll);

// Delete a Pending payroll
router.delete("/:uuid", payrollController.deletePayroll);

// Pending → Processed (locks the record)
router.patch("/:uuid/process", payrollController.processPayroll);
router.post("/calculate", employeeSalaryController.getPayrollCalculation);

module.exports = router;
