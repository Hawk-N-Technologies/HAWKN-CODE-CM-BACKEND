const express = require("express");

const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const sopController = require("../controllers/sopController");
const { sopSchema } = require("../validations/sop.validation");

/**
 * SOPs — every employee reads; only Admin & HR write.
 * Clients never see SOPs.
 */
const router = express.Router();

const UUID_PARAM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Malformed id → 404 (never a database error)
router.param("uuid", (req, res, next, value) => {
  if (!UUID_PARAM.test(value)) {
    return res.status(404).json({ success: false, message: "SOP not found." });
  }
  return next();
});

const anyEmployee = authenticate(["admin", "hr", "developer", "tester", "bde"]);
const editors = authenticate(["admin", "hr"]);

router.get("/", anyEmployee, sopController.listSops);
router.get("/:uuid", anyEmployee, sopController.getSop);
router.post("/", editors, validate(sopSchema), sopController.createSop);
router.put("/:uuid", editors, validate(sopSchema), sopController.updateSop);
router.delete("/:uuid", editors, sopController.deleteSop);

module.exports = router;
