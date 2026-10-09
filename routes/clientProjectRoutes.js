const express = require("express");

const clientProjectController = require("../controllers/clientProjectController");
const authenticate = require("../middleware/authenticate");

/**
 * Client → Dashboard. READ-ONLY on purpose: a client sees their own
 * projects' progress. Managing projects stays with Admin / BDE.
 */
const router = express.Router();

router.use(authenticate(["client"]));

router.get("/", clientProjectController.getDashboardProjects);

module.exports = router;