const express = require("express");
const router = express.Router();
const kanbanController = require("../controllers/kanbanController");

// Change this import path only if your existing auth middleware lives elsewhere.
const authenticate = require("../middleware/authenticate");

router.get(
  "/projects/:projectUuid",
  authenticate(["developer", "tester"]),
  kanbanController.getBoard,
);

router.patch(
  "/tasks/:taskUuid/status",
  authenticate(["developer", "tester"]),
  kanbanController.updateTaskStatus,
);

router.patch(
  "/testing/:testingUuid/result",
  authenticate(["developer", "tester"]),
  kanbanController.updateTestingResult,
);

module.exports = router;
