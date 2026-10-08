const express = require("express");

const projectController = require("../controllers/projectController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const { projectSchema, listProjectsQuerySchema } = require("../validations/project.validation");

const router = express.Router();

// Admin-only (Project Lead pages will get their own routes later)
router.use(authenticate(["admin", "bde"]));

// Dropdown data: active clients + project leads — keep ABOVE "/:uuid"
router.get("/options", projectController.getOptions);

// List: ?status= (optional)
router.get("/", validateQuery(listProjectsQuerySchema), projectController.listProjects);
router.get("/:uuid", projectController.getProject);

router.post("/", validate(projectSchema), projectController.createProject);
router.put("/:uuid", validate(projectSchema), projectController.updateProject);

// Only Planning / Cancelled projects
router.delete("/:uuid", projectController.deleteProject);

module.exports = router;