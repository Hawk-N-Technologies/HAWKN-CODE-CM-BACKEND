const express = require("express");

const {
  markAttendance,
  getTodayAttendance,
} = require("../controllers/attendanceController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post("/mark", authenticate([]), markAttendance);

router.get("/today", authenticate(["hr"]), getTodayAttendance);

module.exports = router;
