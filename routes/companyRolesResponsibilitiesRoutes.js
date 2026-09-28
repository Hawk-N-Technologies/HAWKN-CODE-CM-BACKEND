const express = require("express");

// const authenticate = require("../middleware/authenticate");

const companyRolesResponsibilitiesController = require("../controllers/companyRolesResponsibilitiesController");

const router = express.Router();

router.get(
  "/roles-responsibilities",
  companyRolesResponsibilitiesController.getRolesResponsibilities,
);

router.put(
  "/roles-responsibilities",
  companyRolesResponsibilitiesController.updateRolesResponsibilities,
);

module.exports = router;
