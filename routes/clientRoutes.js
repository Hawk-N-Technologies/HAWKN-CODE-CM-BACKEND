const express = require("express");

const clientController = require("../controllers/clientController");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

// Create client
router.post("/", authenticate(["admin"]), clientController.createClient);

// Get all clients
router.get("/", authenticate(["admin"]), clientController.getClients);

// Get single client
router.get("/:id", authenticate(["admin"]), clientController.getClientById);

// Update client
router.put("/:id", authenticate(["admin"]), clientController.updateClient);

module.exports = router;
