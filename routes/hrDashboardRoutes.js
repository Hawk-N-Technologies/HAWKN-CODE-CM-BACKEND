const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/hrDashboardController");

const router = express.Router();

router.get("/", authenticate(["hr"]), controller.getDashboard);

module.exports = router;