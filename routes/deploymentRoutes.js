const express = require("express");

const deploymentController = require("../controllers/deploymentController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { deploymentSchema } = require("../validations/deployment.validation");

/**
 * Admin → Deployment Planning (one plan per project).
 */
const router = express.Router();

router.use(authenticate(["admin"]));

// All projects + their deployment readiness
router.get("/projects", deploymentController.listProjects);

// One project's plan (defaults if nothing saved yet)
router.get("/projects/:projectUuid", deploymentController.getPlan);

// Save = create first time, update after
router.put("/projects/:projectUuid", validate(deploymentSchema), deploymentController.savePlan);

module.exports = router;