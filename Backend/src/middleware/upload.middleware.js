import multer from "multer";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const allowedExtensions = [".zip", ".json", ".yaml", ".yml"];

const storage = multer.memoryStorage();

const fileFilter = (req, file, callback) => {
  const extension = file.originalname
    .toLowerCase()
    .slice(file.originalname.lastIndexOf("."));

  if (!allowedExtensions.includes(extension)) {
    return callback(
      new Error("Only ZIP, JSON, YAML, and YML files are allowed."),
    );
  }

  callback(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 2,
    parts: 3,
  },
  fileFilter,
});

export const uploadIntegrationFile = upload.single("file");