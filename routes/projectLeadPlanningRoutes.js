"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireProjectLead = require("../middleware/requireProjectLead");
const {
  uploadPlanningDocuments,
} = require("../middleware/planningUpload");
const controller = require("../controllers/projectLeadPlanningController");

const router = express.Router();

router.use(authenticate(["developer"]));
router.use(requireProjectLead);

router.get("/projects", controller.listProjects);
router.get("/projects/:projectUuid", controller.getPlanning);
router.put(
  "/projects/:projectUuid",
  uploadPlanningDocuments,
  controller.savePlanning,
);
router.get(
  "/projects/:projectUuid/files/:kind",
  controller.downloadFile,
);

module.exports = router;