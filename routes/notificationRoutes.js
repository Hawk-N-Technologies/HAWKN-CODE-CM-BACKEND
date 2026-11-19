const express = require("express");
const router = express.Router();

const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/notificationController");

// Every role has notifications; each person only ever sees their own.
const anyRole = authenticate();

router.get("/", anyRole, controller.list);
router.patch("/read-all", anyRole, controller.markAllRead);
router.patch("/:id/read", anyRole, controller.markRead);

// Phone / laptop alerts for this browser
router.get("/push/public-key", anyRole, controller.getPushPublicKey);
router.post("/push/subscribe", anyRole, controller.subscribePush);
router.post("/push/unsubscribe", anyRole, controller.unsubscribePush);

// Development-only test notifications remain Admin-only.
router.post("/test", authenticate(["admin"]), controller.createTestNotification);

module.exports = router;
