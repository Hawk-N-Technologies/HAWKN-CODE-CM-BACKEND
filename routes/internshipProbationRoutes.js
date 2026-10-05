const express = require("express");

const internshipProbationController = require("../controllers/internshipProbationController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  createPeriodSchema,
  reviewPeriodSchema,
  extendPeriodSchema,
  closePeriodSchema,
  listPeriodsQuerySchema,
} = require("../validations/internshipProbation.validation");

const router = express.Router();

// HR-only
router.use(authenticate(["hr"]));

// List: ?periodType=&status=&userUuid= (all optional)
router.get("/", validateQuery(listPeriodsQuerySchema), internshipProbationController.listPeriods);

// Start an internship / probation (sets employee's employment type)
router.post("/", validate(createPeriodSchema), internshipProbationController.createPeriod);

// Review: performance / notes / stipend
router.patch("/:uuid/review", validate(reviewPeriodSchema), internshipProbationController.reviewPeriod);

// Extend the end date
router.post("/:uuid/extend", validate(extendPeriodSchema), internshipProbationController.extendPeriod);

// Close: Confirmed / Converted / Ended / Terminated
router.post("/:uuid/close", validate(closePeriodSchema), internshipProbationController.closePeriod);

module.exports = router;