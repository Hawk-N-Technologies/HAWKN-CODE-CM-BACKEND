"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.resolve(
  __dirname,
  "..",
  "uploads",
  "project-planning",
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

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
    return callback(
      new Error("Upload a PDF, PNG, JPG, WEBP, or SVG document."),
    );
  }

  callback(null, true);
};

module.exports = {
  uploadDirectory,
  uploadPlanningDocuments: multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 2,
    },
  }).fields([
    { name: "erDiagram", maxCount: 1 },
    { name: "flowchart", maxCount: 1 },
  ]),
};