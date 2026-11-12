import assert from "node:assert/strict";

import { classifyFiles } from "../features/Ingestion/fileClassifier.js";

const files = [
  {
    relativePath: "openapi/payouts.openapi.json",
    content: JSON.stringify({
      openapi: "3.0.3",
      paths: {
        "/payouts": {
          post: {
            summary: "Create payout",
          },
        },
      },
    }),
  },
  {
    relativePath: "src/payoutClient.js",
    content:
      'export async function createPayout(data) { return fetch("/payouts", { method: "POST" }); }',
  },
  {
    relativePath: "src/config.js",
    content: "export const baseURL = process.env.PAYMENTS_BASE_URL;",
  },
  {
    relativePath: ".env.example",
    content: "PAYMENTS_BASE_URL=https://example.invalid\nCLIENT_ID=replace-me",
  },
  {
    relativePath: "README.md",
    content: "# Sample integration",
  },
  {
    relativePath: "docs/integration-notes.md",
    content: "Payout integration notes",
  },
];

const result = classifyFiles(files);

assert.equal(result.length, 6);

const categoryByPath = Object.fromEntries(
  result.map(({ relativePath, category }) => [relativePath, category]),
);

assert.equal(
  categoryByPath["openapi/payouts.openapi.json"],
  "API_SPECIFICATION",
);

assert.equal(categoryByPath["src/payoutClient.js"], "PAYMENT_CLIENT");

assert.equal(categoryByPath["src/config.js"], "CONFIGURATION");

assert.equal(categoryByPath[".env.example"], "ENVIRONMENT_TEMPLATE");

assert.equal(categoryByPath["README.md"], "DOCUMENTATION");

assert.equal(categoryByPath["docs/integration-notes.md"], "DOCUMENTATION");

// Reject paths that attempt to escape the expected root.
assert.throws(
  () => classifyFiles([{ relativePath: "../outside.js", content: "" }]),
  /Unsafe file path|Path traversal|Invalid relative file path/,
);

// Reject duplicate paths.
assert.throws(
  () =>
    classifyFiles([
      {
        relativePath: "src/config.js",
        content: "",
      },
      {
        relativePath: "src/config.js",
        content: "",
      },
    ]),
  /Duplicate file path/,
);

console.log("File classifier tests passed.");
console.log(`Total files classified: ${result.length}`);

const summary = result.reduce((acc, file) => {
  acc[file.category] = (acc[file.category] || 0) + 1;
  return acc;
}, {});

console.log("Category summary:", summary);