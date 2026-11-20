const express = require("express");

const authenticate = require("../middleware/authenticate");
const { getDashboard } = require("../services/bdDashboardService");

/** BD Dashboard numbers — read-only, scoped to the user's company. */
const router = express.Router();

router.get("/dashboard", authenticate(["bde", "admin"]), async (req, res, next) => {
  try {
    const data = await getDashboard(req.user.companyId);
    return res.status(200).json({ success: true, message: "BD dashboard fetched successfully", data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
