const express = require("express");

const projectController = require("../controllers/projectController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  projectSchema,
  listProjectsQuerySchema,
} = require("../validations/project.validation");

const router = express.Router();

// Admin-only (Project Lead pages will get their own routes later)
router.use(authenticate(["admin", "bde"]));

// Dropdown data: active clients + project leads — keep ABOVE "/:uuid"
router.get(
  "/options",
  authenticate(["admin", "bde"]),
  projectController.getOptions,
);

// List: ?status= (optional)
router.get(
  "/",
  authenticate(["admin", "bde"]),
  validateQuery(listProjectsQuerySchema),
  projectController.listProjects,
);
router.get(
  "/:uuid",
  authenticate(["admin", "bde"]),
  projectController.getProject,
);

router.post(
  "/",
  authenticate(["admin", "bde"]),
  validate(projectSchema),
  projectController.createProject,
);
router.put(
  "/:uuid",
  authenticate(["admin", "bde"]),
  validate(projectSchema),
  projectController.updateProject,
);

// Only Planning / Cancelled projects
router.delete(
  "/:uuid",
  authenticate(["admin"]),
  projectController.deleteProject,
);

module.exports = router;
