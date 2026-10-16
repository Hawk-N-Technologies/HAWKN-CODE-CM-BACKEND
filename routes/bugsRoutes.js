const express = require("express");
const router = express.Router();

const bugController = require("../controllers/bugsController");
const authMiddleware = require("../middleware/authenticate");
const isPLRequired = require("../middleware/requireProjectLead");
// Apply your existing client authentication and authorization middleware.
router.post(
  "/bugs",
  authMiddleware(["client", "tester"]),
  bugController.reportBug,
);
router.post(
  "/createBug",
  authMiddleware(["developer"]),
  isPLRequired.requireProjectLead,
  bugController.reportBug,
);

module.exports = router;
