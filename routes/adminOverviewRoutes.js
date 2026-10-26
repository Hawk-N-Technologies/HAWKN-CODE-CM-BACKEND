const express = require("express");
const authenticate = require("../middleware/authenticate");
const {
  getAdminOverview,
} = require("../controllers/adminOverviewController");

const router = express.Router();

router.get(
  "/overview",
  authenticate(["admin"]),
  getAdminOverview,
);

module.exports = router;
