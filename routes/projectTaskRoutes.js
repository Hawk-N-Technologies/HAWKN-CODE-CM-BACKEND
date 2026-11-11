const express = require("express");
const authenticate = require("../middleware/authenticate");
const projectTaskController = require("../controllers/projectTaskController");
const ProjectTask = require("../models/ProjectTask");
const ProjectPhase = require("../models/ProjectPhase");
const {
  projectFrom,
  requireProjectAccess,
  requireLeadOfProject,
} = require("../middleware/projectAccess");
const router = express.Router();

// Every project/task route checks the project is in the user's company.
// Writes also require being the lead of THIS project.

router.post(
  "/projects/:projectUuid/tasks",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.param("projectUuid")),
  projectTaskController.createTask,
);

router.get(
  "/projects/:projectUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.param("projectUuid")),
  projectTaskController.listProjectTasks,
);

router.get(
  "/projects/:projectUuid/modules/:moduleUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.param("projectUuid")),
  projectTaskController.listModuleTasks,
);

router.get(
  "/projects/:projectUuid/modules/:moduleUuid/phases/:phaseUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.param("projectUuid")),
  projectTaskController.listPhaseTasks,
);

router.get(
  "/tasks/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  requireProjectAccess(projectFrom.child(ProjectTask, "uuid")),
  projectTaskController.getTaskByUuid,
);

router.put(
  "/tasks/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectTask, "uuid")),
  projectTaskController.updateTask,
);

router.delete(
  "/tasks/:uuid",
  authenticate(["developer"]),
  requireLeadOfProject(projectFrom.child(ProjectTask, "uuid")),
  projectTaskController.deleteTask,
);

// Already scoped to the user's company inside the service
router.get(
  "/developers-testers",
  authenticate(["developer"]),
  projectTaskController.getDevelopersAndTesters,
);

router.get(
  "/my-tasks",
  authenticate(["developer"]),
  projectTaskController.getMyTasks,
);

router.patch(
  "/my-tasks/:taskUuid/status",
  authenticate(["developer"]),
  projectTaskController.updateMyTaskStatus,
);

// :phaseId is the phase UUID
router.get(
  "/task-dropdown/:phaseId",
  authenticate(["developer"]),
  requireProjectAccess(projectFrom.child(ProjectPhase, "phaseId")),
  projectTaskController.taskDropdown,
);

module.exports = router;