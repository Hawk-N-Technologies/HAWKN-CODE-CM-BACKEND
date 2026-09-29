const express = require("express");

const authenticate = require("../middleware/authenticate");
const companyProfileController = require("../controllers/companyProfileController");

const router = express.Router();

router.get(
  "/profile",
  authenticate(["admin"]),
  companyProfileController.getCompanyProfile,
);

router.put(
  "/profile/:uuid",
  authenticate(["admin"]),
  companyProfileController.updateCompanyProfile,
);

module.exports = router;
