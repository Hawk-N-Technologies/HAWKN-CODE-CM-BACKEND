const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/notificationController");

const notificationRoles = authenticate(["admin", "hr", "bde"]);

router.get("/", notificationRoles, controller.list);
router.patch("/read-all", notificationRoles, controller.markAllRead);
router.patch("/:id/read", notificationRoles, controller.markRead);

// Development-only test notifications remain Admin-only.
router.post("/test", authenticate(["admin"]), controller.createTestNotification);

module.exports = router;