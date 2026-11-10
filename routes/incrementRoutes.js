const express = require("express");

const incrementController = require("../controllers/incrementController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  createIncrementSchema,
  updateIncrementSchema,
  listIncrementsQuerySchema,
} = require("../validations/bonusIncrement.validation");

const router = express.Router();

// HR-only
router.use(authenticate(["hr"]));

// History: ?userUuid= (optional)
router.get("/", validateQuery(listIncrementsQuerySchema), incrementController.listIncrements);

// Give an increment (also updates Salary Structure)
router.post("/", validate(createIncrementSchema), incrementController.createIncrement);

// Edit the latest increment (also updates Salary Structure)
router.put("/:uuid", validate(updateIncrementSchema), incrementController.updateIncrement);

// Revert the latest increment (restores previous salary)
router.delete("/:uuid", incrementController.revertIncrement);

module.exports = router;