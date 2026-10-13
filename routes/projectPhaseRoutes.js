const projectPhaseController = require("../controllers/projectPhaseController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();
const requireProjectLead = require("../middleware/requireProjectLead");
router.get(
  "/projects/:projectUuid/modules/:moduleUuid/phases",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectPhaseController.getPhasesByModule,
);

router.post(
  "/projects/:projectUuid/modules/:moduleUuid/phases",
  authenticate(["developer"]),
  requireProjectLead,
  projectPhaseController.createPhase,
);

router.get(
  "/phases/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectPhaseController.getPhase,
);

router.put(
  "/phases/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectPhaseController.updatePhase,
);

router.delete(
  "/phases/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectPhaseController.deletePhase,
);

module.exports = router;
