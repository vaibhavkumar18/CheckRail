
import assert from "node:assert/strict";
import { buildFileManifest } from "../features/Ingestion/fileManifest.js";
import { scanFileBuffers } from "../features/Ingestion/secretScanner.js";

const files = [
  {
    relativePath: "src/config.js",
    buffer: Buffer.from(
      'const clientSecret = "example_secret_value_123456789";\n',
      "utf8",
    ),
  },
  {
    relativePath: "README.md",
    buffer: Buffer.from("# Sample integration\n", "utf8"),
  },
];

const manifest = buildFileManifest(files);

assert.equal(manifest.length, 2);
assert.equal(manifest[0].relativePath, "src/config.js");
assert.equal(typeof manifest[0].sha256, "string");
assert.equal(manifest[0].sha256.length, 64);

const scanResult = scanFileBuffers(files);

assert.equal(scanResult.filesScanned, 2);
assert.ok(scanResult.findingsCount > 0);

const serializedResult = JSON.stringify(scanResult);

assert.ok(serializedResult.includes("src/config.js"));
assert.ok(!serializedResult.includes("example_secret_value_123456789"));

console.log("Ingestion module tests passed.");
console.log(JSON.stringify(scanResult, null, 2));
