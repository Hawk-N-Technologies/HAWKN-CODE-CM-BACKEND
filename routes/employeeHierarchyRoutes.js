const express = require("express");

const authenticate = require("../middleware/authenticate");

const employeeHierarchyController = require("../controllers/employeeHierarchyController");

const router = express.Router();

router.get(
  "/hierarchy",
  authenticate(["admin"]),
  employeeHierarchyController.getHierarchyImages,
);

router.post(
  "/hierarchy",
  authenticate(["admin"]),
  employeeHierarchyController.uploadHierarchyImages,
);

router.delete(
  "/hierarchy/:imageUuid",
  authenticate(["admin"]),
  employeeHierarchyController.deleteHierarchyImage,
);

module.exports = router;
