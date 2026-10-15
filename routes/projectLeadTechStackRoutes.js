"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const { requireProjectLead } = require("../middleware/requireProjectLead");
const controller = require("../controllers/projectLeadTechStackController");

const router = express.Router();

router.use(authenticate(["developer"]));
router.use(requireProjectLead);

router.get("/projects", controller.listProjects);
router.get("/projects/:projectUuid", controller.getStack);
router.put("/projects/:projectUuid", controller.saveStack);

module.exports = router;
