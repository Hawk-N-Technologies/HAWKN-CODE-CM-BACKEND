const express = require("express");

const {
  createHoliday,
  getAllHolidays,
} = require("../controllers/companyHolidayController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post("/holidays", authenticate(["hr"]), createHoliday);

router.get("/holidays", authenticate(["hr"]), getAllHolidays);

module.exports = router;
