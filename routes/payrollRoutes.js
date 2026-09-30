const express = require("express");

const payrollController = require("../controllers/payrollController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  createPayrollSchema,
  listPayrollQuerySchema,
  searchEmployeesQuerySchema,
} = require("../validations/payroll.validation");

const router = express.Router();

// Payroll is HR-only
router.use(authenticate(["hr"]));

// Name autocomplete — must stay ABOVE "/:uuid" routes
router.get(
  "/employees/search",
  validateQuery(searchEmployeesQuerySchema),
  payrollController.searchEmployees,
);

// List with filters: ?startDate=&endDate=&userUuid=&status=
router.get("/", validateQuery(listPayrollQuerySchema), payrollController.listPayroll);

// Create (net salary is calculated by the server)
router.post("/", validate(createPayrollSchema), payrollController.createPayroll);

// Pending → Processed (locks the record)
router.patch("/:uuid/process", payrollController.processPayroll);

module.exports = router;