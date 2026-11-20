const express = require("express");
const authenticate = require("../middleware/authenticate");
const {
  getAdminOverview,
  getDevelopmentMonitoring,
} = require("../controllers/adminOverviewController");

const router = express.Router();

router.get(
  "/overview",
  authenticate(["admin"]),
  getAdminOverview,
);

// Read-only: project progress, overdue tasks, open bugs, developer workload
router.get(
  "/development-monitoring",
  authenticate(["admin"]),
  getDevelopmentMonitoring,
);

module.exports = router;
