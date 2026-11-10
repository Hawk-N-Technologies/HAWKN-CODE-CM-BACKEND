"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.resolve(
  __dirname,
  "..",
  "uploads",
  "company-stories",
);

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowed = new Map([
  [".pdf", new Set(["application/pdf"])],
  [
    ".docx",
    new Set([
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]),
  ],
  [".txt", new Set(["text/plain"])],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const validMimes = allowed.get(extension);

  if (!validMimes || !validMimes.has(file.mimetype)) {
    const error = new Error("Only PDF, DOCX, and TXT files are accepted.");
    error.statusCode = 400;
    return callback(error);
  }

  return callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
}).single("companyStoryDocument");

function uploadCompanyStory(req, res, next) {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      error.statusCode = 413;
      error.message = "The document must be 10 MB or smaller.";
    } else if (error.code === "LIMIT_UNEXPECTED_FILE") {
      error.statusCode = 400;
      error.message =
        "Use the companyStoryDocument field and upload one file at a time.";
    } else if (!error.statusCode) {
      error.statusCode = 400;
    }

    return next(error);
  });
}

module.exports = {
  uploadDirectory,
  uploadCompanyStory,
};
