const express = require("express");

const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const testingController = require("../controllers/testingController");
const {
  createBuildSchema,
  buildResultSchema,
  phaseSignOffSchema,
  phaseDecisionSchema,
  createTrainingSchema,
  updateTrainingSchema,
} = require("../validations/testing.validation");

/**
 * Testing module — Build Testing, Phase Testing, client phase approval,
 * Field Training. Each role only sees its own projects (see testingService).
 */
const router = express.Router();

const UUID_PARAM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Malformed id → 404 (never a database error)
router.param("uuid", (req, res, next, value) => {
  if (!UUID_PARAM.test(value)) {
    return res.status(404).json({ success: false, message: "Not found." });
  }
  return next();
});

const tester = authenticate(["tester"]);
const client = authenticate(["client"]);

router.get("/tester/projects", tester, testingController.listTesterProjects);

// Build Testing
router.get("/builds", authenticate(["tester", "admin"]), testingController.listBuilds);
router.post("/builds", tester, validate(createBuildSchema), testingController.createBuild);
router.patch("/builds/:uuid/result", tester, validate(buildResultSchema), testingController.recordBuildResult);

// Phase Testing (tester sign-off)
router.get("/phases", authenticate(["tester", "admin"]), testingController.listPhases);
router.patch("/phases/:uuid/sign-off", tester, validate(phaseSignOffSchema), testingController.signOffPhase);

// Client approval
router.get("/client/phases", client, testingController.listClientPhases);
router.patch("/client/phases/:uuid/decision", client, validate(phaseDecisionSchema), testingController.decidePhase);

// Field Training
router.get("/trainings", authenticate(["tester", "client", "admin"]), testingController.listTrainings);
router.post("/trainings", tester, validate(createTrainingSchema), testingController.createTraining);
router.put("/trainings/:uuid", tester, validate(updateTrainingSchema), testingController.updateTraining);

module.exports = router;
