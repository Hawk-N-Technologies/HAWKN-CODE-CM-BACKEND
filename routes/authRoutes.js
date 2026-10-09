const express = require("express");

const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const router = express.Router();

router.post("/login", authController.login);
router.get(
  "/me",
  authenticate(["admin", "hr", "bde", "developer", "client"]),
  authController.getMe,
);
router.post("/logout", authController.logout);

module.exports = router;
