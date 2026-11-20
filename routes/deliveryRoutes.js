const express = require("express");

const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const deliveryController = require("../controllers/deliveryController");
const {
  createDeliverySchema,
  updateDeliverySchema,
  sendBackSchema,
  followUpSchema,
} = require("../validations/delivery.validation");

/**
 * Delivery & Handover
 *   tester → submit / fix & resubmit
 *   admin  → approve (to client) / send back with a note
 *   client → accept (completes the project) / follow-up (Change Request)
 * Each role only ever sees deliveries of its own projects (see deliveryService).
 */
const router = express.Router();

const UUID_PARAM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Malformed id → 404 (never a database error)
router.param("uuid", (req, res, next, value) => {
  if (!UUID_PARAM.test(value)) {
    return res.status(404).json({ success: false, message: "Delivery not found." });
  }
  return next();
});

router.get(
  "/",
  authenticate(["admin", "tester", "client"]),
  deliveryController.listDeliveries,
);

router.get(
  "/tester/projects",
  authenticate(["tester"]),
  deliveryController.testerProjects,
);

router.post(
  "/",
  authenticate(["tester"]),
  validate(createDeliverySchema),
  deliveryController.createDelivery,
);

router.put(
  "/:uuid",
  authenticate(["tester"]),
  validate(updateDeliverySchema),
  deliveryController.updateDelivery,
);

router.patch(
  "/:uuid/approve",
  authenticate(["admin"]),
  deliveryController.approveDelivery,
);

router.patch(
  "/:uuid/send-back",
  authenticate(["admin"]),
  validate(sendBackSchema),
  deliveryController.sendBackDelivery,
);

router.patch(
  "/:uuid/accept",
  authenticate(["client"]),
  deliveryController.acceptDelivery,
);

router.post(
  "/:uuid/follow-up",
  authenticate(["client"]),
  validate(followUpSchema),
  deliveryController.requestFollowUp,
);

module.exports = router;
