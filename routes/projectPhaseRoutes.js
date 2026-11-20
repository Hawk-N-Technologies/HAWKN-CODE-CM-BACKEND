const projectPhaseController = require("../controllers/projectPhaseController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();
const ProjectPhase = require("../models/ProjectPhase");
const {
  projectFrom,
  requireProjectAccess,
  requireLeadOfProject,
} = require("../middleware/projectAccess");

// Every route checks the project is in the user's company.
// Writes also require being the lead of THIS project.

router.get(
  "/projects/:projectUuid/modules/:moduleUuid/phases",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.param("projectUuid")),
  projectPhaseController.getPhasesByModule,
);

router.post(
  "/projects/:projectUuid/modules/:moduleUuid/phases",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.param("projectUuid")),
  projectPhaseController.createPhase,
);

router.get(
  "/phases/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.child(ProjectPhase, "uuid")),
  projectPhaseController.getPhase,
);

router.put(
  "/phases/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectPhase, "uuid")),
  projectPhaseController.updatePhase,
);

router.delete(
  "/phases/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectPhase, "uuid")),
  projectPhaseController.deletePhase,
);

module.exports = router;