const employeeLeaveController = require("../controllers/employeeLeaveController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();

router.get(
  "/leaves",
  authenticate(["hr"]),
  employeeLeaveController.getLeaveRequests,
);
router.post(
  "/",
  authenticate(["hr", "developer", "tester", "bde"]),
  employeeLeaveController.createLeaveRequest,
);
router.get(
  "/",
  authenticate(["hr", "developer", "tester", "bde"]),
  employeeLeaveController.getMyLeaves,
);

router.patch(
  "/leaves/:uuid",
  authenticate(["hr"]),
  employeeLeaveController.updateLeaveRequest,
);

module.exports = router;
