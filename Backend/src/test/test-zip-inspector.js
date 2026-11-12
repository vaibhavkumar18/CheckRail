import fs from "node:fs/promises";

import { inspectZipBuffer } from "../features/Ingestion/zipInspector.js";

const main = async () => {
  const zipPath = process.argv[2];

  if (!zipPath) {
    throw new Error(
      "Usage: node test-zip-inspector.js <path-to-zip>",
    );
  }

  const buffer = await fs.readFile(zipPath);
  const result = await inspectZipBuffer(buffer);

  console.log(
    JSON.stringify(
      {
        valid: result.valid,
        entryCount: result.entryCount,
        totalUncompressedSize: result.totalUncompressedSize,
        entries: result.entries,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error("ZIP inspection failed:", error.message);
  process.exitCode = 1;
});