const express = require("express");

const adminHrmsController = require("../controllers/adminHrmsController");
const authenticate = require("../middleware/authenticate");
const validateQuery = require("../middleware/validateQuery");
const {
  attendanceQuerySchema,
  leavesQuerySchema,
  payrollQuerySchema,
} = require("../validations/adminHrms.validation");

/**
 * Admin HRMS — READ-ONLY. Only GET routes exist here on purpose:
 * admins can see all HR data but change none of it (HR owns the data).
 */
const router = express.Router();

router.use(authenticate(["admin"]));

router.get("/summary", adminHrmsController.getSummary);
router.get("/employees", adminHrmsController.getEmployees);
router.get("/attendance", validateQuery(attendanceQuerySchema), adminHrmsController.getAttendance); // ?date=
router.get("/leaves", validateQuery(leavesQuerySchema), adminHrmsController.getLeaves); // ?status=
router.get("/payroll", validateQuery(payrollQuerySchema), adminHrmsController.getPayroll); // ?month=
router.get("/internship-probation", adminHrmsController.getInternshipProbation);

module.exports = router;