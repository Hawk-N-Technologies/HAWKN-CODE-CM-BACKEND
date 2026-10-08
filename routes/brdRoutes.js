const express = require("express");

const brdController = require("../controllers/brdController");
const authenticate = require("../middleware/authenticate");
const brdUpload = require("../middleware/brdUpload");

const router = express.Router();

router.post(
  "/",
  authenticate(["bde"]),
  brdUpload.single("brdFile"),
  brdController.uploadBRD,
);
router.get(
  "/versions/:versionUuid/file",
  authenticate(["admin", "bde", "client"]),
  brdController.getBRDFile,
);
router.get("/projects", authenticate(["bde"]), brdController.getAllProjects);

router.get("/summary", authenticate(["bde"]), brdController.getBRDSummary);

router.get("/history", authenticate(["bde"]), brdController.getBRDHistory);
module.exports = router;
