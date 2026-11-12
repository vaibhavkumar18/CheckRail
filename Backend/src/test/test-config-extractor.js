import assert from "node:assert/strict";

import {
  extractConfigEvidence,
} from "../features/Ingestion/Evidence/extractors/configExtractor.js";

const files = [
  {
    relativePath: "src/config.js",
    content: `
const config = {
  baseURL: process.env.PAYPAL_API_URL,
  timeout: 5000,
  clientId: process.env.PAYPAL_CLIENT_ID,
  clientSecret: process.env.PAYPAL_CLIENT_SECRET,
  maxRetries: 3,
  retryDelay: 1000,
  idempotencyKey: process.env.PAYPAL_IDEMPOTENCY_KEY,
  tokenUrl: process.env.PAYPAL_TOKEN_URL,
};

export default config;
`,
  },

  {
    relativePath: "config/settings.json",
    content: JSON.stringify({
      apiUrl: "https://api.example.com",
      timeout: 5000,
      maxRetries: 3,
      environment: "sandbox",
    }),
  },

  {
    relativePath: ".env.example",
    content: `
PAYPAL_API_URL=https://api.example.com
PAYPAL_CLIENT_ID=example-client-id
PAYPAL_CLIENT_SECRET=example-secret
PAYPAL_ACCESS_TOKEN=example-token
NODE_ENV=development
`,
  },
];

const result = extractConfigEvidence(files);
console.log("Processing summary:", result.summary);
console.log("Processing errors:", result.errors);
// 1. General result structure.
assert.equal(result.evidenceType, "CONFIGURATION");
assert.equal(result.summary.totalFiles, 3);
assert.equal(result.summary.filesProcessed, 3);
assert.equal(result.summary.filesSkipped, 0);
assert.equal(result.summary.errorCount, 0);

// 2. Expected evidence types.
const types = new Set(
  result.evidence.map((item) => item.evidenceType),
);

assert.ok(types.has("CONFIGURATION_KEY"));
assert.ok(types.has("CONFIGURATION_DEFAULT"));
assert.ok(types.has("ENVIRONMENT_VARIABLE_REFERENCE"));
assert.ok(types.has("ENVIRONMENT_VARIABLE_DECLARATION"));
assert.ok(types.has("URL_CONFIGURATION"));
assert.ok(types.has("AUTHENTICATION_CONFIGURATION"));
assert.ok(types.has("TIMEOUT_CONFIGURATION"));
assert.ok(types.has("RETRY_CONFIGURATION"));
assert.ok(types.has("IDEMPOTENCY_CONFIGURATION"));

// 3. Environment variable references.
const envReferences = result.evidence.filter(
  (item) =>
    item.evidenceType === "ENVIRONMENT_VARIABLE_REFERENCE",
);

assert.ok(
  envReferences.some(
    (item) => item.subject === "PAYPAL_API_URL",
  ),
);

// 4. Environment file declarations.
const envDeclarations = result.evidence.filter(
  (item) =>
    item.evidenceType === "ENVIRONMENT_VARIABLE_DECLARATION",
);

assert.ok(
  envDeclarations.some(
    (item) => item.subject === "PAYPAL_CLIENT_SECRET",
  ),
);

// 5. Secret values must never appear.
const serializedResult = JSON.stringify(result);

assert.ok(!serializedResult.includes("example-secret"));
assert.ok(!serializedResult.includes("example-token"));
assert.ok(!serializedResult.includes("example-client-id"));

// 6. Source references must be preserved.
for (const item of result.evidence) {
  assert.ok(item.source.file);
  assert.ok(Number.isInteger(item.source.line));
}

// 7. Unsupported files should be skipped.
const unsupportedResult = extractConfigEvidence([
  {
    relativePath: "README.md",
    content: "# Configuration",
  },
]);

assert.equal(unsupportedResult.summary.filesProcessed, 0);
assert.equal(unsupportedResult.summary.filesSkipped, 1);

// 8. Invalid file paths should be reported.
const unsafePathResult = extractConfigEvidence([
  {
    relativePath: "../config.js",
    content: "const config = {};",
  },
]);

assert.equal(unsafePathResult.summary.filesProcessed, 0);
assert.equal(unsafePathResult.summary.filesSkipped, 1);
assert.equal(
  unsafePathResult.errors[0].type,
  "FILE_PROCESSING_ERROR",
);

// 9. Invalid JavaScript should produce a parse error.
const invalidSourceResult = extractConfigEvidence([
  {
    relativePath: "src/config.js",
    content: "const config = {",
  },
]);

assert.equal(invalidSourceResult.summary.filesSkipped, 1);
assert.equal(invalidSourceResult.errors[0].type, "PARSE_ERROR");

// 10. Oversized files should be skipped.
const largeFileResult = extractConfigEvidence([
  {
    relativePath: "src/config.js",
    content: "a".repeat(1_000_001),
  },
]);

assert.equal(largeFileResult.summary.filesSkipped, 1);
assert.match(
  largeFileResult.errors[0].message,
  /exceeds the/,
);

// 11. Invalid input should throw.
assert.throws(
  () => extractConfigEvidence("invalid"),
  /expects an array/,
);

console.log("Config extractor tests passed.");

console.log(
  JSON.stringify(result.summary, null, 2),
);

// 12. Evidence limit must be strictly enforced.
const largeConfigSource = `
const config = {
  ${Array.from(
    { length: 4000 },
    () => "timeout: 1000",
  ).join(",\n")}
};
`;

const evidenceLimitResult = extractConfigEvidence([
  {
    relativePath: "src/large-config.js",
    content: largeConfigSource,
  },
]);

assert.equal(
  evidenceLimitResult.evidence.length,
  10_000,
  "Evidence count must never exceed 10,000",
);

assert.equal(
  evidenceLimitResult.summary.evidenceCount,
  10_000,
);

assert.equal(
  evidenceLimitResult.summary.evidenceLimit,
  10_000,
);

assert.equal(
  evidenceLimitResult.summary.evidenceLimitReached,
  true,
);

console.log("Evidence limit boundary test passed.");