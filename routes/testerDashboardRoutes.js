"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/testerDashboardController");

const router = express.Router();

router.use(authenticate(["tester"]));

router.get("/projects", controller.getAssignedProjects);
router.get("/overview", controller.getOverview);

module.exports = router;