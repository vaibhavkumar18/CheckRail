import path from "node:path";
import { createHash } from "node:crypto";

const normalizeRelativePath = (relativePath) => {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("A valid relative file path is required.");
  }

  if (relativePath.includes("\0") || relativePath.includes("\\")) {
    throw new Error("Invalid file path.");
  }

  if (path.posix.isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
    throw new Error("Absolute file paths are not allowed.");
  }

  const normalizedPath = path.posix.normalize(relativePath);

  if (
    normalizedPath === "." ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../")
  ) {
    throw new Error("Path traversal is not allowed.");
  }

  return normalizedPath;
};

export const createFileManifestEntry = (relativePath, buffer) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("File contents must be provided as a Buffer.");
  }

  const safePath = normalizeRelativePath(relativePath);

  return {
    relativePath: safePath,
    size: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
};

export const buildFileManifest = (files) => {
  if (!Array.isArray(files)) {
    throw new TypeError("Files must be provided as an array.");
  }

  const seenPaths = new Set();

  return files.map(({ relativePath, buffer }) => {
    const entry = createFileManifestEntry(relativePath, buffer);
    const pathKey = entry.relativePath.toLowerCase();

    if (seenPaths.has(pathKey)) {
      throw new Error(`Duplicate file path detected: ${entry.relativePath}`);
    }

    seenPaths.add(pathKey);

    return entry;
  });
};
