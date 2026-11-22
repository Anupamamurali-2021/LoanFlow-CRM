
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const uploadDirectory = path.join(
  __dirname,
  "..",
  "private_uploads"
);

// Create the private upload directory if needed.
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(
      file.originalname
    ).toLowerCase();

    const uniqueName =
      crypto.randomUUID() + extension;

    cb(null, uniqueName);
  },
});

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const allowedExtensions = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
];

const fileFilter = (req, file, cb) => {
  const extension = path.extname(
    file.originalname
  ).toLowerCase();

  if (
    !allowedMimeTypes.includes(file.mimetype) ||
    !allowedExtensions.includes(extension)
  ) {
    return cb(
      new Error(
        "Only PDF, JPG, and PNG files are allowed."
      )
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

module.exports = {
  upload,
  uploadDirectory,
};
