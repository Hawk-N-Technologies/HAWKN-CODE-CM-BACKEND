const express = require("express");
const router = express.Router();

const operationsController = require("../controllers/operationsController");
const authenticate = require("../middleware/authenticate");

router.get(
  "/projects",
  authenticate(["admin"]),
  operationsController.getApprovedProjects,
);

router.get(
  "/options",
  authenticate(["admin"]),
  operationsController.getOperationsOptions,
);

router.put(
  "/projects/:projectId",
  authenticate(["admin"]),
  operationsController.saveOperationsPlan,
);
router.get(
  "/my-projects",
  authenticate(["developer"]),
  operationsController.getMyProjects,
);
module.exports = router;
