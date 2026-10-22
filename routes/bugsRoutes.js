const express = require("express");
const router = express.Router();

const bugController = require("../controllers/bugsController");
const authMiddleware = require("../middleware/authenticate");
const { requireProjectLead } = require("../middleware/requireProjectLead");
// Apply your existing client authentication and authorization middleware.
router.post(
  "/bugs",
  authMiddleware(["client", "tester"]),
  bugController.reportBug,
);
router.post(
  "/createBug",
  authMiddleware(["developer"]),
  requireProjectLead,
  bugController.reportBug,
);
router.get(
  "/projects/:projectId/bugs",
  authMiddleware(["developer"]),
  requireProjectLead,
  bugController.fetchProjectBugs,
);

router.get(
  "/developers",
  authMiddleware(["developer"]),
  requireProjectLead,
  bugController.getDevelopers,
);

router.patch(
  "/projects/:projectId/bugs/:bugId",
  authMiddleware(["developer"]),
  requireProjectLead,
  bugController.updateProjectBug,
);

router.get(
  "/projects/:projectId/assigned-bugs",
  authMiddleware(["developer"]),
  bugController.fetchAssignedBugs,
);

router.get(
  "/projects-dropdown",
  authMiddleware(["developer", "tester"]),
  bugController.projectsDropdown,
);
router.get(
  "/issued-bugs",
  authMiddleware(["client"]),
  bugController.getReportedIssues,
);
router.get(
  "/issuesForTester",
  authMiddleware(["tester"]),
  bugController.getIssuesForTester,
);

router.patch(
  "/issues/:uuid/status",
  authMiddleware(["tester"]),
  bugController.updateIssueStatus,
);

router.put(
  "/developer/:uuid/status",
  authMiddleware(["developer"]),
  bugController.updateBugStatus,
);

router.post(
  "/createByTester",
  authMiddleware(["tester"]),
  bugController.createBugByTester,
);

router.get(
  "/tester/bugs",
  authMiddleware(["tester"]),
  bugController.getBugsInTester,
);

router.patch(
  "/tester/bugs/:uuid",
  authMiddleware(["tester"]),
  bugController.updateBugByTester,
);
// Cr

module.exports = router;
