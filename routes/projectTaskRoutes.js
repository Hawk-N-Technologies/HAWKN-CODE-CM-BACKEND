const express = require("express");
const authenticate = require("../middleware/authenticate");
const projectTaskController = require("../controllers/projectTaskController");
const requireProjectLead = require("../middleware/requireProjectLead");
const router = express.Router();

router.post(
  "/projects/:projectUuid/tasks",
  authenticate(["developer"]),
  requireProjectLead,
  projectTaskController.createTask,
);

router.get(
  "/projects/:projectUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectTaskController.listProjectTasks,
);

router.get(
  "/projects/:projectUuid/modules/:moduleUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectTaskController.listModuleTasks,
);

router.get(
  "/projects/:projectUuid/modules/:moduleUuid/phases/:phaseUuid/tasks",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectTaskController.listPhaseTasks,
);

router.get(
  "/tasks/:uuid",
  authenticate(["hr", "developer", "tester", "bde"]),
  projectTaskController.getTaskByUuid,
);

router.put(
  "/tasks/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectTaskController.updateTask,
);

router.delete(
  "/tasks/:uuid",
  authenticate(["developer"]),
  requireProjectLead,
  projectTaskController.deleteTask,
);

module.exports = router;
