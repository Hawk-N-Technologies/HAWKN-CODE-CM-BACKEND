const express = require("express");

const authenticate = require("../middleware/authenticate");

const companyRolesResponsibilitiesController = require("../controllers/companyRolesResponsibilitiesController");

const router = express.Router();

router.get(
  "/roles-responsibilities",
  authenticate(["admin"]),
  companyRolesResponsibilitiesController.getRolesResponsibilities,
);

router.put(
  "/roles-responsibilities/:uuid",
  authenticate(["admin"]),
  companyRolesResponsibilitiesController.updateRolesResponsibilities,
);

module.exports = router;
