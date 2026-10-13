"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireProjectLead = require("../middleware/requireProjectLead");
const controller = require("../controllers/projectLeadTeamController");

const router = express.Router();

router.use(authenticate(["developer"]));
router.use(requireProjectLead);

router.get("/projects", controller.listProjects);
router.get("/projects/:projectUuid", controller.getTeam);
router.put("/projects/:projectUuid", controller.saveTeam);

module.exports = router;