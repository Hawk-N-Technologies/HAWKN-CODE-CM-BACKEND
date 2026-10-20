const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/notificationController");

router.use(authenticate(["admin"]));

router.get("/", controller.list);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

// The controller returns 404 in production.
router.post("/test", controller.createTestNotification);

module.exports = router;