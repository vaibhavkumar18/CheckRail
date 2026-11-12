import fs from "node:fs/promises";
import path from "node:path";
import { inspectZipBuffer } from "../features/Ingestion/zipInspector.js";
import { extractZipBuffer } from "../features/Ingestion/zipExtractor.js";

const main = async () => {
  console.log("\n=== CorridorGate ZIP Ingestion Test ===\n");

  const zipPath = process.argv[2];

  if (!zipPath) {
    throw new Error(
      'Provide the ZIP path. Example: node test-zip-extractor.js "./fixture.zip"',
    );
  }

  const resolvedPath = path.resolve(zipPath);

  console.log("Step 1: Reading ZIP file...");
  console.log("Path:", resolvedPath);

  const buffer = await fs.readFile(resolvedPath);

  console.log("File read successfully.");
  console.log("Compressed file size:", buffer.length, "bytes");

  console.log("\nStep 2: Running ZIP inspector...");

  const inspection = await inspectZipBuffer(buffer);

  console.log("Inspector result:", inspection.valid);
  console.log("Entries found:", inspection.entryCount);
  console.log(
    "Total uncompressed size:",
    inspection.totalUncompressedSize,
    "bytes",
  );

  if (!inspection.valid) {
    throw new Error("ZIP inspection failed.");
  }

  console.log("\nStep 3: Running ZIP extractor...");

  // The extractor performs inspection again before extracting.
  const extraction = await extractZipBuffer(buffer);

  console.log("\nStep 4: Extraction completed.");

  console.log(
    JSON.stringify(
      {
        success: true,
        inspection: {
          valid: inspection.valid,
          entryCount: inspection.entryCount,
          totalUncompressedSize: inspection.totalUncompressedSize,
        },
        extraction: {
          directory: extraction.extractionDir,
          entryCount: extraction.entryCount,
          fileCount: extraction.fileCount,
          totalBytesWritten: extraction.totalBytesWritten,
          manifest: extraction.manifest,
        },
      },
      null,
      2,
    ),
  );

  console.log("\n=== ZIP Ingestion Test Passed ===\n");
};

main().catch((error) => {
  console.error("\n=== ZIP Ingestion Test Failed ===");
  console.error("Error:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
