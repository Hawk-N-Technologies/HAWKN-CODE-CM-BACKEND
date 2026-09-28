const express = require("express");

const companyController = require("../controllers/companyController");

const router = express.Router();

router.get("/", companyController.getAllCompanies);

router.get("/:uuid", companyController.getCompany);

module.exports = router;
