const express = require("express");

const authenticate = require("../middleware/authenticate");
const companyPolicyController = require("../controllers/companyPolicyController");

const router = express.Router();

router.get(
  "/policies",
  authenticate(["admin"]),
  companyPolicyController.getCompanyPolicies,
);

router.put(
  "/policies",
  authenticate(["admin"]),
  companyPolicyController.updateCompanyPolicies,
);

module.exports = router;
