const express = require("express");
const authenticate = require("../middleware/authenticate");
const employeeHierarchyController = require("../controllers/employeeHierarchyController");
const { uploadHierarchyImages } = require("../middleware/hierarchyUpload");

const router = express.Router();

// View: admin + HR (HR is read-only)
router.get(
  "/hierarchy",
  authenticate(["admin", "hr"]),
  employeeHierarchyController.getHierarchyImages,
);

router.get(
  "/hierarchy/:imageUuid/file",
  authenticate(["admin", "hr"]),
  employeeHierarchyController.getHierarchyImageFile,
);

// Upload / delete: admin only. Form field name: "images" (up to 5)
router.post(
  "/hierarchy",
  authenticate(["admin"]),
  uploadHierarchyImages,
  employeeHierarchyController.uploadHierarchyImages,
);

router.delete(
  "/hierarchy/:imageUuid",
  authenticate(["admin"]),
  employeeHierarchyController.deleteHierarchyImage,
);

module.exports = router;