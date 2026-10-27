const express = require("express");
const router = express.Router();
const controller = require("../controllers/manualAttendanceController");
const authenticate = require("../middleware/authenticate");

// Mount this router behind your existing authentication + HR/ADMIN authorization middleware.
// Example mount: app.use('/api/attendance/manual', authMiddleware, hrOnly, manualAttendanceRoutes)
router.get("/today", authenticate(["hr"]), controller.getToday);
router.post(
  "/:employeeId/mark",
  authenticate(["hr"]),
  controller.markAttendance,
);

module.exports = router;
