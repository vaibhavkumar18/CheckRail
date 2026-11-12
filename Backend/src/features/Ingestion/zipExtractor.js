import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import yauzl from "yauzl";
import { createWriteStream } from "node:fs";
import { inspectZipBuffer } from "./zipInspector.js";
import { validateArchivePath } from "../../utils/safePaths.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

const openZip = (buffer) =>
  yauzl.fromBufferPromise(buffer, {
    lazyEntries: true,
    decodeStrings: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });

const openEntryStream = (zipFile, entry) =>
  new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      resolve(stream);
    });
  });
async function* iterateZipEntries(zipFile) {
  while (true) {
    const result = await new Promise((resolve, reject) => {
      const cleanup = () => {
        zipFile.removeListener("entry", onEntry);
        zipFile.removeListener("end", onEnd);
        zipFile.removeListener("error", onError);
      };

      const onEntry = (entry) => {
        cleanup();
        resolve({ entry, done: false });
      };

      const onEnd = () => {
        cleanup();
        resolve({ done: true });
      };

      const onError = (error) => {
        cleanup();
        reject(error);
      };

      zipFile.once("entry", onEntry);
      zipFile.once("end", onEnd);
      zipFile.once("error", onError);

      // Tell yauzl to read the next entry.
      console.log("[Extractor] Requesting next ZIP entry...");
      zipFile.readEntry();
    });

    if (result.done) return;

    yield result.entry;
  }
}
export const extractZipBuffer = async (buffer) => {
  // 1. Inspect the entire archive before extracting anything.
  const inspection = await inspectZipBuffer(buffer);

  // 2. Create an isolated temporary directory.
  const extractionDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "corridorgate-"),
  );

  let zipFile;
  let totalBytesWritten = 0;
  const manifest = [];

  // Track actual file paths to prevent overwriting files.
  const writtenPaths = new Set();

  try {
    console.log("[Extractor] Opening ZIP...");
    zipFile = await openZip(buffer);
    console.log("[Extractor] ZIP opened.");

    for await (const entry of iterateZipEntries(zipFile)) {
      console.log("[Extractor] Processing entry:", entry.fileName);
      const { relativePath, isDirectory } = validateArchivePath(entry.fileName);

      const destination = path.resolve(
        extractionDir,
        ...relativePath.split("/"),
      );

      // 3. Ensure the resolved path remains inside the extraction directory.
      const relativeDestination = path.relative(extractionDir, destination);

      if (
        relativeDestination === "" ||
        relativeDestination === ".." ||
        relativeDestination.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeDestination)
      ) {
        throw new Error("ZIP entry escapes the extraction directory.");
      }

      if (writtenPaths.has(relativePath)) {
        throw new Error(`Duplicate ZIP path: ${relativePath}`);
      }

      writtenPaths.add(relativePath);

      if (isDirectory) {
        await fs.mkdir(destination, { recursive: true });
        continue;
      }

      // 4. Check declared sizes before opening the decompression stream.
      if (entry.uncompressedSize > MAX_FILE_SIZE) {
        throw new Error(`File exceeds the permitted size: ${relativePath}`);
      }

      await fs.mkdir(path.dirname(destination), {
        recursive: true,
      });

      const hash = createHash("sha256");
      let fileBytes = 0;

      const limiter = new Transform({
        transform(chunk, encoding, callback) {
          fileBytes += chunk.length;
          totalBytesWritten += chunk.length;

          if (fileBytes > MAX_FILE_SIZE) {
            return callback(
              new Error(`Actual file size limit exceeded: ${relativePath}`),
            );
          }

          if (totalBytesWritten > MAX_TOTAL_SIZE) {
            return callback(
              new Error("Actual total extraction size limit exceeded."),
            );
          }

          hash.update(chunk);
          callback(null, chunk);
        },
      });

      console.log("[Extractor] Opening entry stream:", relativePath);

      const input = await openEntryStream(zipFile, entry);

      console.log("[Extractor] Entry stream opened:", relativePath);

      // "wx" prevents overwriting an existing file.
      const output = createWriteStream(destination, {
        flags: "wx",
        mode: 0o600,
      });

      try {
        console.log("[Extractor] Starting pipeline:", relativePath);

        await pipeline(input, limiter, output);

        console.log("[Extractor] Pipeline completed:", relativePath);
      } catch (error) {
        output.destroy();
        throw error;
      }

      // 5. Verify actual decompressed size against ZIP metadata.
      console.log("[Extractor] Verifying size:", relativePath);

      if (fileBytes !== entry.uncompressedSize) {
        throw new Error(`Decompressed size mismatch: ${relativePath}`);
      }

      console.log("[Extractor] Calculating hash:", relativePath);

      manifest.push({
        relativePath,
        size: fileBytes,
        sha256: hash.digest("hex"),
      });

      console.log("[Extractor] Entry completed:", relativePath);
    }

    // Verify the extraction did not omit or add archive entries.
    if (
      manifest.length !==
      inspection.entries.filter((entry) => !entry.isDirectory).length
    ) {
      throw new Error("Extracted file count does not match ZIP inspection.");
    }

    return {
      extractionDir,
      entryCount: inspection.entryCount,
      fileCount: manifest.length,
      totalBytesWritten,
      manifest,
    };
  } catch (error) {
    await fs.rm(extractionDir, {
      recursive: true,
      force: true,
    });

    throw error;
  } finally {
    zipFile?.close();
  }
};
