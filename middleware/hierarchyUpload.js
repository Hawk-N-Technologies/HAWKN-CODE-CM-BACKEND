"use strict";

/**
 * Upload for Employee Hierarchy images (Admin).
 * Same pattern as planningUpload.js. Accepts the image types the
 * hierarchy service allows: PNG, JPG, WEBP — up to 5 files, 10 MB each.
 * Upload problems become a clear 400 instead of a server error.
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.resolve(
  __dirname,
  "..",
  "uploads",
  "employee-hierarchy",
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const storage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, uploadDirectory);
  },

  filename(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedExtensions.has(extension) ||
    !allowedMimeTypes.has(file.mimetype)
  ) {
    return callback(new Error("Upload a PNG, JPG or WEBP image."));
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
}).array("images", 5);

// Turn upload errors into a 400 with a readable message
function uploadHierarchyImages(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();

    const messages = {
      LIMIT_FILE_SIZE: "Each image must be 10 MB or smaller.",
      LIMIT_FILE_COUNT: "Upload up to 5 images at a time.",
      LIMIT_UNEXPECTED_FILE: "Upload up to 5 images at a time.",
    };

    return res.status(400).json({
      success: false,
      message: messages[error.code] || error.message,
    });
  });
}

module.exports = {
  uploadDirectory,
  uploadHierarchyImages,
};