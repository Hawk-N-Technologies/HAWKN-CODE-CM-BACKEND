"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const { requireProjectLead } = require("../middleware/requireProjectLead");
const { uploadPlanningDocuments } = require("../middleware/planningUpload");
const {
  projectFrom,
  requireLeadOfProject,
} = require("../middleware/projectAccess");
const controller = require("../controllers/projectLeadPlanningController");

const router = express.Router();

router.get(
  "/projects",
  authenticate(["developer", "admin"]),
  requireProjectLead,
  controller.listProjects,
);
router.get(
  "/projects/:projectUuid",
  authenticate(["developer"]),
  requireProjectLead,
  controller.getPlanning,
);
router.put(
  "/projects/:projectUuid",
  authenticate(["developer"]),
  uploadPlanningDocuments,
  requireProjectLead,
  controller.savePlanning,
);
router.get(
  "/projects/:projectUuid/files/:kind",
  authenticate(["developer", "admin"]),
  requireLeadOfProject(projectFrom.param("projectUuid"), { allowAdmin: true }),
  controller.getPlanningFileController,
);

module.exports = router;
