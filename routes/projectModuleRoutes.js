const projectModuleController = require("../controllers/projectModuleController");
const authenticate = require("../middleware/authenticate");
const express = require("express");
const router = express.Router();
const { requireProjectLead } = require("../middleware/requireProjectLead");

// Get all modules for a project
router.get(
  "/projects/:projectUuid/modules",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectModuleController.getModulesByProject,
);

// Create a module
router.post(
  "/projects/:projectUuid/modules",
  authenticate(["developer"]),
  requireProjectLead,
  projectModuleController.createModule,
);

// Get one module by UUID
router.get(
  "/modules/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectModuleController.getModule,
);

// Update a module by UUID
router.put(
  "/modules/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectModuleController.updateModule,
);

// Delete a module by UUID
router.delete(
  "/modules/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectModuleController.deleteModule,
);

module.exports = router;
