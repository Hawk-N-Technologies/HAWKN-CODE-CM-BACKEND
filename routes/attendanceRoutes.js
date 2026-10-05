const express = require("express");

const {
  markAttendance,
  getTodayAttendance,
  getAttendanceHistory,
  getMyMonthlyAttendance,
} = require("../controllers/attendanceController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post("/mark", authenticate([]), markAttendance);

router.get("/today", authenticate(["hr"]), getTodayAttendance);

router.get("/history", authenticate(["hr"]), getAttendanceHistory);
router.get(
  "/monthly",
  authenticate(["hr", "developer", "tester", "bde"]),
  getMyMonthlyAttendance,
);

module.exports = router;
