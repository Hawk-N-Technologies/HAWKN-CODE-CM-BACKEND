const projectModuleController = require("../controllers/projectModuleController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();
const ProjectModule = require("../models/ProjectModule");
const {
  projectFrom,
  requireProjectAccess,
  requireLeadOfProject,
} = require("../middleware/projectAccess");

// Every route checks the project is in the user's company.
// Writes also require being the lead of THIS project.

// Get all modules for a project
router.get(
  "/projects/:projectUuid/modules",
  authenticate(["hr", "developer", "tester", "bde", "client"]),
  requireProjectAccess(projectFrom.param("projectUuid")),
  projectModuleController.getModulesByProject,
);

// Create a module
router.post(
  "/projects/:projectUuid/modules",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.param("projectUuid")),
  projectModuleController.createModule,
);

// Get one module by UUID
router.get(
  "/modules/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.child(ProjectModule, "uuid")),
  projectModuleController.getModule,
);

// Update a module by UUID
router.put(
  "/modules/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectModule, "uuid")),
  projectModuleController.updateModule,
);

// Delete a module by UUID
router.delete(
  "/modules/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectModule, "uuid")),
  projectModuleController.deleteModule,
);

module.exports = router;