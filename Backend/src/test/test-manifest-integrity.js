
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildFileManifest } from "../features/Ingestion/fileManifest.js";
import { scanExtractedDirectory } from "../features/Ingestion/secretScanner.js";

const extractionDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "corridorgate-test-"),
);

try {
  const relativePath = "src/config.js";
  const originalBuffer = Buffer.from(
    'const clientSecret = "example_secret_value_123456789";\n',
    "utf8",
  );

  const filePath = path.join(extractionDir, "src", "config.js");

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, originalBuffer);

  const manifest = buildFileManifest([
    { relativePath, buffer: originalBuffer },
  ]);

  // An unchanged file must pass integrity verification.
  const result = await scanExtractedDirectory(extractionDir, manifest);

  assert.equal(result.filesScanned, 1);
  assert.equal(result.findingsCount, 1);
  assert.equal(
    JSON.stringify(result).includes("example_secret_value_123456789"),
    false,
  );

  // A modified file must fail integrity verification.
  await fs.writeFile(filePath, "modified content");

  await assert.rejects(
    () => scanExtractedDirectory(extractionDir, manifest),
    /File integrity verification failed/,
  );

  console.log("Manifest integrity tests passed.");
} finally {
  await fs.rm(extractionDir, { recursive: true, force: true });
}
