const express = require("express");

// const authenticate = require("../middleware/authenticate");

const employeeHierarchyController = require("../controllers/employeeHierarchyController");

const router = express.Router();

router.get("/hierarchy", employeeHierarchyController.getHierarchyImages);

router.post("/hierarchy", employeeHierarchyController.uploadHierarchyImages);

router.delete(
  "/hierarchy/:imageUuid",
  employeeHierarchyController.deleteHierarchyImage,
);

module.exports = router;
