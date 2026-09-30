const express = require("express");

const employeeOnboardingController = require("../controllers/employeeOnboardingController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Every onboarding route is HR-only (same as /api/employees)
router.use(authenticate(["hr"]));

// Roles for the "Start Onboarding" dropdown (admin + client excluded)
router.get("/roles", employeeOnboardingController.getOnboardableRoles);

// All onboarding records for the HR user's company
router.get("/", employeeOnboardingController.listOnboarding);

// Start onboarding = create user + employee + checklist
router.post("/", employeeOnboardingController.startOnboarding);

// Tick / untick one checklist step
router.patch("/:uuid/checklist", employeeOnboardingController.updateChecklistItem);

// Cancel (candidate didn't join) — blocked once completed
router.delete("/:uuid", employeeOnboardingController.cancelOnboarding);

module.exports = router;