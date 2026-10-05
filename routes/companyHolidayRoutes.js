const express = require("express");

const {
  createHoliday,
  getAllHolidays,
  deleteHoliday,
} = require("../controllers/companyHolidayController");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post("/holidays", authenticate(["hr"]), createHoliday);

router.get("/holidays", authenticate(["hr"]), getAllHolidays);

router.delete("/holidays/:uuid", authenticate(["hr"]), deleteHoliday);

module.exports = router;
