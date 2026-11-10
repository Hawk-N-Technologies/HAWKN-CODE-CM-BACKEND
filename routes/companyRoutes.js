const express = require("express");
const authenticate = require("../middleware/authenticate");
const companyController = require("../controllers/companyController");

const router = express.Router();

router.get("/", authenticate(["admin"]), companyController.getAllCompanies);

router.get("/:uuid", authenticate(["admin"]), companyController.getCompany);

module.exports = router;
