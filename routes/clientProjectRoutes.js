const express = require("express");

const clientProjectController = require("../controllers/clientProjectController");
const clientProjectPhasesController = require("../controllers/clientProjectPhasesController");
const authenticate = require("../middleware/authenticate");

/**
 * Client dashboard is read-only.
 * Clients can access only their own projects and project progress.
 */
const router = express.Router();

router.use(authenticate(["client"]));

router.get("/", clientProjectController.getDashboardProjects);

router.get(
  "/:projectUuid/phases",
  clientProjectPhasesController.getProjectPhases,
);

module.exports = router;