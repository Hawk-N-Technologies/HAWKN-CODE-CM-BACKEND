const employeeLeaveController = require("../controllers/employeeLeaveController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();

router.get(
  "/leaves",
  authenticate(["hr"]),
  employeeLeaveController.getLeaveRequests,
);

router.patch(
  "/leaves/:uuid",
  authenticate(["hr"]),
  employeeLeaveController.updateLeaveRequest,
);

module.exports = router;
