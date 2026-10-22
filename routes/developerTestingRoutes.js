"use strict";

const express = require("express");
const authenticate = require("../middleware/authenticate");
const controller = require("../controllers/developerTestingController");

const router = express.Router();

router.use(authenticate(["developer"]));

router.get("/", controller.getMyTestingRecords);

router.put("/:taskUuid", controller.saveTestingResult);

module.exports = router;