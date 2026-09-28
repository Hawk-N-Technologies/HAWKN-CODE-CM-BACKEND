const express = require("express");

// const authenticate = require("../middleware/authenticate");
const companyPolicyController = require("../controllers/companyPolicyController");

const router = express.Router();

router.get(
  "/policies",
  companyPolicyController.getCompanyPolicies,
);

router.put(
  "/policies",
  companyPolicyController.updateCompanyPolicies,
);

module.exports = router;
