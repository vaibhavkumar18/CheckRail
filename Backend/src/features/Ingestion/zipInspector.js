import yauzl from "yauzl";

import { validateArchivePath } from "../../utils/safePaths.js";

const DEFAULT_LIMITS = {
  maxEntries: 5000,
  maxFileSize: 20 * 1024 * 1024, // 20 MB per file
  maxTotalUncompressedSize: 100 * 1024 * 1024, // 100 MB total
  maxCompressionRatio: 100,
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
};

const openZipBuffer = async (buffer) => {
  try {
    return await yauzl.fromBufferPromise(buffer, {
      lazyEntries: true,
      decodeStrings: true,
      strictFileNames: true,
      validateEntrySizes: true,
    });
  } catch {
    throw createValidationError(
      "The uploaded file is not a valid, supported ZIP archive.",
    );
  }
};

/**
 * Reject duplicate paths and file/directory conflicts.
 *
 * Examples rejected:
 * - Duplicate: src/config.js appears twice.
 * - File/directory conflict: src is a file, but src/config.js exists.
 * - Reverse conflict: src/config.js exists, but src is also a file.
 *
 * Explicit directory entries are permitted when their paths do not conflict.
 */
const validateEntryPathConflicts = (relativePath, isDirectory, seenPaths) => {
  const existingType = seenPaths.get(relativePath);

  if (existingType) {
    throw createValidationError(
      `ZIP contains duplicate entry paths: ${relativePath}`,
    );
  }

  const segments = relativePath.split("/");

  // No ancestor path may already be a file.
  for (let i = 1; i < segments.length; i++) {
    const parentPath = segments.slice(0, i).join("/");
    const parentType = seenPaths.get(parentPath);

    if (parentType === "file") {
      throw createValidationError(
        `ZIP contains a file/directory path conflict: ${parentPath}`,
      );
    }
  }

  // A new file cannot replace an existing directory or a path
  // that already has descendants.
  if (!isDirectory) {
    const descendantPrefix = `${relativePath}/`;

    for (const [existingPath, existingEntryType] of seenPaths) {
      if (existingEntryType === "directory" && existingPath === relativePath) {
        throw createValidationError(
          `ZIP contains a file/directory path conflict: ${relativePath}`,
        );
      }

      if (existingPath.startsWith(descendantPrefix)) {
        throw createValidationError(
          `ZIP contains a file/directory path conflict: ${relativePath}`,
        );
      }
    }
  }

  seenPaths.set(relativePath, isDirectory ? "directory" : "file");
};

export const inspectZipBuffer = async (buffer, customLimits = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw createValidationError("A non-empty ZIP buffer is required.");
  }

  const limits = {
    ...DEFAULT_LIMITS,
    ...customLimits,
  };

  // Reject invalid or unsafe custom limits.
  if (
    !Number.isSafeInteger(limits.maxEntries) ||
    limits.maxEntries < 1 ||
    !Number.isSafeInteger(limits.maxFileSize) ||
    limits.maxFileSize < 1 ||
    !Number.isSafeInteger(limits.maxTotalUncompressedSize) ||
    limits.maxTotalUncompressedSize < 1 ||
    typeof limits.maxCompressionRatio !== "number" ||
    !Number.isFinite(limits.maxCompressionRatio) ||
    limits.maxCompressionRatio < 1
  ) {
    throw new Error("ZIP inspection limits are invalid.");
  }

  const zipFile = await openZipBuffer(buffer);

  const entries = [];
  const seenPaths = new Map();

  let totalUncompressedSize = 0;

  try {
    for await (const entry of zipFile.eachEntry()) {
      if (entries.length >= limits.maxEntries) {
        throw createValidationError(
          "ZIP exceeds the maximum permitted number of entries.",
        );
      }

      const { relativePath, isDirectory } = validateArchivePath(entry.fileName);

      // Reject encrypted entries; decryption is not supported.
      if (entry.generalPurposeBitFlag & 0x1) {
        throw createValidationError("Encrypted ZIP entries are not supported.");
      }

      // Reject symbolic links. Extraction must not create filesystem links.
      const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;

      const fileType = unixMode & 0xf000;

      if (fileType === 0xa000) {
        throw createValidationError("ZIP symbolic links are not permitted.");
      }

      const uncompressedSize = entry.uncompressedSize;
      const compressedSize = entry.compressedSize;

      if (
        !Number.isSafeInteger(uncompressedSize) ||
        !Number.isSafeInteger(compressedSize) ||
        uncompressedSize < 0 ||
        compressedSize < 0
      ) {
        throw createValidationError(
          "ZIP contains invalid entry size metadata.",
        );
      }

      if (!isDirectory && uncompressedSize > limits.maxFileSize) {
        throw createValidationError(
          `ZIP entry exceeds the maximum permitted file size: ${relativePath}`,
        );
      }

      totalUncompressedSize += uncompressedSize;

      if (
        !Number.isSafeInteger(totalUncompressedSize) ||
        totalUncompressedSize > limits.maxTotalUncompressedSize
      ) {
        throw createValidationError(
          "ZIP exceeds the maximum permitted uncompressed size.",
        );
      }

      if (uncompressedSize > 0 && compressedSize === 0) {
        throw createValidationError(
          "ZIP contains suspicious compression metadata.",
        );
      }

      if (compressedSize > 0) {
        const compressionRatio = uncompressedSize / compressedSize;

        if (compressionRatio > limits.maxCompressionRatio) {
          throw createValidationError(
            `ZIP entry exceeds the permitted compression ratio: ${relativePath}`,
          );
        }
      }

      validateEntryPathConflicts(relativePath, isDirectory, seenPaths);

      entries.push({
        relativePath,
        isDirectory,
        compressedSize,
        uncompressedSize,
        compressionMethod: entry.compressionMethod,
      });
    }
  } catch (error) {
    // Preserve validation errors; normalize unexpected archive errors.
    if (error.statusCode === 422) {
      throw error;
    }

    throw createValidationError(
      "ZIP inspection failed because the archive is malformed or unreadable.",
    );
  } finally {
    zipFile.close();
  }

  if (entries.length === 0) {
    throw createValidationError("ZIP archive contains no entries.");
  }

  return {
    valid: true,
    entryCount: entries.length,
    totalUncompressedSize,
    entries,
  };
};
