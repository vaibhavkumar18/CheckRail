import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SECRET_PATTERNS = [
  {
    type: "PRIVATE_KEY",
    severity: "CRITICAL",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  {
    type: "AWS_ACCESS_KEY",
    severity: "HIGH",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    type: "GENERIC_API_KEY",
    severity: "HIGH",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_\-/+=]{12,}/i,
  },
  {
    type: "DATABASE_CREDENTIAL",
    severity: "HIGH",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?:\/\/)[^\s"'<>]+/i,
  },
  {
    type: "JWT_TOKEN",
    severity: "MEDIUM",
    pattern:
      /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
];

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 1000;

const SKIPPED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".exe",
  ".dll",
  ".so",
  ".bin",
]);

const isTextCandidate = (relativePath) => {
  const extension = path.posix.extname(relativePath).toLowerCase();

  if (SKIPPED_EXTENSIONS.has(extension)) {
    return false;
  }

  // Scan extensionless files and common source/config/documentation files.
  return true;
};

const scanText = (relativePath, text) => {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const rule of SECRET_PATTERNS) {
      if (rule.pattern.test(line)) {
        findings.push({
          file: relativePath,
          line: index + 1,
          type: rule.type,
          severity: rule.severity,
        });
      }
    }
  }

  return findings;
};

const validateRelativePath = (relativePath) => {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error("Invalid relative file path.");
  }

  const normalized = path.posix.normalize(relativePath);

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error("Path traversal is not allowed.");
  }

  return normalized;
};

export const scanFileBuffers = (files) => {
  if (!Array.isArray(files)) {
    throw new TypeError("Files must be provided as an array.");
  }

  if (files.length > MAX_FILES) {
    throw new Error("File scan limit exceeded.");
  }

  let totalBytes = 0;
  let filesScanned = 0;
  const findings = [];
  const seenPaths = new Set();

  for (const file of files) {
    const relativePath = validateRelativePath(file.relativePath);

    if (seenPaths.has(relativePath)) {
      throw new Error(`Duplicate file path detected: ${relativePath}`);
    }

    seenPaths.add(relativePath);

    if (!Buffer.isBuffer(file.buffer)) {
      throw new TypeError(`File contents must be a Buffer: ${relativePath}`);
    }

    if (!isTextCandidate(relativePath)) {
      continue;
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
      continue;
    }

    totalBytes += file.buffer.length;

    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("Total file scan size limit exceeded.");
    }

    // Avoid scanning binary content as text.
    if (file.buffer.includes(0)) {
      continue;
    }

    const text = file.buffer.toString("utf8");
    filesScanned += 1;
    findings.push(...scanText(relativePath, text));
  }

  return {
    filesScanned,
    findingsCount: findings.length,
    findings,
  };
};

export const scanExtractedDirectory = async (extractionDir, manifest) => {
  if (!Array.isArray(manifest)) {
    throw new TypeError("A valid extracted file manifest is required.");
  }

  const root = path.resolve(extractionDir);
  const files = [];

  for (const entry of manifest) {
    const relativePath = validateRelativePath(entry.relativePath);
    const absolutePath = path.resolve(root, ...relativePath.split("/"));

    if (
      absolutePath === root ||
      !absolutePath.startsWith(`${root}${path.sep}`)
    ) {
      throw new Error("File path escapes the extraction directory.");
    }

    const buffer = await fs.readFile(absolutePath);

    if (buffer.length !== entry.size) {
      throw new Error(`File integrity verification failed: ${relativePath}`);
    }

    const actualSHA256 = createHash("sha256").update(buffer).digest("hex");

    if (
      typeof entry.sha256 !== "string" ||
      actualSHA256 !== entry.sha256.toLowerCase()
    ) {
      throw new Error(`File integrity verification failed: ${relativePath}`);
    }

    files.push({ relativePath, buffer });
  }

  return scanFileBuffers(files);
};
