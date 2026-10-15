const express = require("express");

const clientController = require("../controllers/clientController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Create client
router.post("/", authenticate(["admin", "bde"]), clientController.createClient);

// Get all clients
router.get("/", authenticate(["admin", "bde"]), clientController.getClients);

// Get single client
router.get("/:id", authenticate(["admin"]), clientController.getClientById);

// Update client
router.put(
  "/:id",
  authenticate(["admin", "bde"]),
  clientController.updateClient,
);

module.exports = router;
