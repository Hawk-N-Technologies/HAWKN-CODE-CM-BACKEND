const express = require("express");

const bonusController = require("../controllers/bonusController");
const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const validateQuery = require("../middleware/validateQuery");
const {
  createBonusSchema,
  listBonusesQuerySchema,
  bonusTotalQuerySchema,
} = require("../validations/bonusIncrement.validation");

const router = express.Router();

// HR-only
router.use(authenticate(["hr"]));

// Payroll auto-fill: ?userUuid=&payPeriod=2026-10 — keep ABOVE "/:uuid"
router.get("/total", validateQuery(bonusTotalQuerySchema), bonusController.getBonusTotal);

// List: ?userUuid= (optional)
router.get("/", validateQuery(listBonusesQuerySchema), bonusController.listBonuses);

// Add a bonus
router.post("/", validate(createBonusSchema), bonusController.createBonus);

// Delete (blocked once that month's payroll is processed)
router.delete("/:uuid", bonusController.deleteBonus);

module.exports = router;