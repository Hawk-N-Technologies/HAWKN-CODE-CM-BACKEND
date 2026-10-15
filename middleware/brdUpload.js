"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// --------------------------------------------------
// Upload directory
// --------------------------------------------------

// Backend project root
const uploadDirectory = path.resolve(__dirname, "..", "uploads", "brds");

// Create directory if it doesn't exist
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

// --------------------------------------------------
// Storage
// --------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Make absolutely sure the directory exists
    fs.mkdir(uploadDirectory, { recursive: true }, (error) => {
      if (error) {
        return cb(error);
      }

      cb(null, uploadDirectory);
    });
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    const uniqueName = `${crypto.randomUUID()}${extension}`;

    cb(null, uniqueName);
  },
});

// --------------------------------------------------
// File filter
// --------------------------------------------------

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Only PDF, DOC and DOCX files are allowed"), false);
  }

  cb(null, true);
};

// --------------------------------------------------
// Multer
// --------------------------------------------------

const uploadBRD = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

module.exports = uploadBRD;
