import { z } from "zod";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_EXTENSIONS = [".zip", ".json", ".yaml", ".yml"];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "application/octet-stream",
  "text/plain",
]);

const getExtension = (filename) => {
  const lastDot = filename.lastIndexOf(".");

  if (lastDot <= 0) {
    return "";
  }

  return filename.slice(lastDot).toLowerCase();
};

const projectIdSchema = z.string().regex(UUID_REGEX, "Invalid project ID.");

export const validateProjectId = (req, res, next) => {
  const result = projectIdSchema.safeParse(req.params.projectId);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid project ID.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  next();
};

export const validateIntegrationFile = (req, res, next) => {
  const file = req.file;
  console.log("Validating integration file:", file);

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded. Use the form-data field 'file'.",
    });
  }

  const errors = [];
  const originalName = file.originalname;

  if (typeof originalName !== "string" || originalName.trim().length === 0) {
    errors.push({
      field: "file",
      message: "Filename is required.",
    });
  } else {
    if (
      originalName !== originalName.trim() ||
      originalName.length > 255 ||
      /[/\\\0-\x1f\x7f]/.test(originalName) ||
      originalName === "." ||
      originalName === ".."
    ) {
      errors.push({
        field: "file",
        message: "Invalid filename.",
      });
    }

    const extension = getExtension(originalName);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      errors.push({
        field: "file",
        message: "Only ZIP, JSON, YAML, and YML files are allowed.",
      });
    }

    if (
      extension === ".zip" &&
      ![
        "application/zip",
        "application/x-zip-compressed",
        "application/octet-stream",
      ].includes(file.mimetype)
    ) {
      errors.push({
        field: "file",
        message: "The ZIP file has an unexpected MIME type.",
      });
    }

    if (
      [".json", ".yaml", ".yml"].includes(extension) &&
      !ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      errors.push({
        field: "file",
        message: "The specification file has an unexpected MIME type.",
      });
    }
  }

  if (!Buffer.isBuffer(file.buffer)) {
    errors.push({
      field: "file",
      message: "Uploaded file data is invalid.",
    });
  }

  if (
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size > MAX_FILE_SIZE
  ) {
    errors.push({
      field: "file",
      message: "File size must be between 1 byte and 20 MB.",
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Uploaded file validation failed.",
      errors,
    });
  }

  next();
};
