const express = require("express");

const authenticate = require("../middleware/authenticate");
const companyProfileController = require("../controllers/companyProfileController");
const { uploadCompanyStory } = require("../middleware/companyStoryUpload");

const router = express.Router();

router.get(
  "/profile",
  authenticate(["admin"]),
  companyProfileController.getCompanyProfile,
);

router.put(
  "/profile/:uuid",
  authenticate(["admin"]),
  companyProfileController.updateCompanyProfile,
);

router.post(
  "/profile/:uuid/story-document",
  authenticate(["admin"]),
  uploadCompanyStory,
  companyProfileController.uploadCompanyStoryDocument,
);

module.exports = router;
