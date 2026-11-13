const express = require("express");
const router = express.Router();

const bugController = require("../controllers/bugsController");
const authMiddleware = require("../middleware/authenticate");
const { requireProjectLead } = require("../middleware/requireProjectLead");
const {
  projectFrom,
  requireProjectAccess,
  requireLeadOfProject,
} = require("../middleware/projectAccess");

// Company + ownership/assignment checks for client and tester routes live in
// bugsService (the project comes from the body or from the bug itself).

router.post(
  "/bugs",
  authMiddleware(["client", "tester"]),
  bugController.reportBug,
);

router.post(
  "/issue-report",
  authMiddleware(["client"]),
  bugController.createIssueReport,
);

// Project lead routes: lead of THIS project only
router.post(
  "/createBug",
  authMiddleware(["developer"]),
  requireLeadOfProject(projectFrom.body("projectId")),
  bugController.reportBug,
);

router.get(
  "/projects/:projectId/bugs",
  authMiddleware(["developer"]),
  requireLeadOfProject(projectFrom.param("projectId")),
  bugController.fetchProjectBugs,
);

// Any project lead; list is limited to the lead's own company
router.get(
  "/developers",
  authMiddleware(["developer"]),
  requireProjectLead,
  bugController.getDevelopers,
);

router.patch(
  "/projects/:projectId/bugs/:bugId",
  authMiddleware(["developer"]),
  requireLeadOfProject(projectFrom.param("projectId")),
  bugController.updateProjectBug,
);

// :projectId may be the numeric id or the UUID
router.get(
  "/projects/:projectId/assigned-bugs",
  authMiddleware(["developer"]),
  requireProjectAccess(projectFrom.param("projectId")),
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

// Tester → Retesting page
router.get(
  "/tester/retests",
  authMiddleware(["tester"]),
  bugController.getRetestQueue,
);

router.patch(
  "/tester/retests/:uuid",
  authMiddleware(["tester"]),
  bugController.recordRetestResult,
);

module.exports = router;