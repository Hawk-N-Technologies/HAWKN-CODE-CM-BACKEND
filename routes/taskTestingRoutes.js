const express = require("express");
const router = express.Router();

const taskTestingController = require("../controllers/taskTestingController");
const authenticate = require("../middleware/authenticate");

router.get(
  "/",
  authenticate(["tester"]),
  taskTestingController.getTestingQueue,
);
router.patch(
  "/:uuid/status",
  authenticate(["tester"]),
  taskTestingController.updateTestingStatus,
);

module.exports = router;
