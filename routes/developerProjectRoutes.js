const express = require("express");

const developerProjectController = require("../controllers/developerProjectController");
const authenticate = require("../middleware/authenticate");

/**
 * Developer → My Projects. READ-ONLY on purpose: a developer sees the
 * projects they lead. Creating / editing projects stays with Admin / BDE.
 */
const router = express.Router();

router.use(authenticate(["developer"]));

router.get("/", developerProjectController.listMyProjects);

module.exports = router;