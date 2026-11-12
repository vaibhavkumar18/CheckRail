import assert from "node:assert/strict";

import {
  extractDocumentationEvidence,
} from "../features/Ingestion/Evidence/extractors/documentationExtractor.js";

// --------------------------------------------------
// Test fixtures
// --------------------------------------------------

const files = [
  {
    relativePath: "docs/payment-flow.md",
    content: `
# Payment Integration

## Payment Creation

Create a payment using the provider REST API.
Capture the authorized payment after confirmation.
Refunds can be initiated through the refund endpoint.

## Authentication

Use OAuth 2.0 client credentials to obtain an access token.
Include the bearer token in the Authorization header.

## Webhooks

Register a webhook endpoint for payment events.
Verify the webhook signature before processing events.

## Error Handling

Handle failed payment requests and API error responses.

## Retry Policy

Use exponential backoff for retryable failures.

## Idempotency

Include an idempotency key to prevent duplicate payments.

## Environments

Use the sandbox environment for testing.
Switch to production credentials before going live.

## API Reference

POST /v1/payments
GET /v1/payments/{paymentId}

## Security

Never expose credentials in client-side code.
Use HTTPS for secure communication.
`,
  },

  {
    relativePath: "README.txt",
    content: `
Payment integration instructions.

The API supports payout creation.
OAuth 2.0 authentication is required.
Webhook signature verification is recommended.
`,
  },

  {
    relativePath: "docs/integration.mdx",
    content: `
# Integration Guide

Use an idempotency key for payment requests.

Configure the sandbox environment before testing.
`,
  },
];

// --------------------------------------------------
// Normal extraction
// --------------------------------------------------

const result = extractDocumentationEvidence(files);

console.log("Processing summary:", result.summary);

assert.equal(result.evidenceType, "DOCUMENTATION");

assert.equal(result.summary.totalFiles, 3);
assert.equal(result.summary.filesProcessed, 3);
assert.equal(result.summary.filesSkipped, 0);
assert.equal(result.summary.errorCount, 0);

// --------------------------------------------------
// Expected evidence categories
// --------------------------------------------------

const types = new Set(
  result.evidence.map((item) => item.evidenceType),
);

assert.ok(types.has("PAYMENT_FLOW_DOCUMENTATION"));
assert.ok(types.has("AUTHENTICATION_DOCUMENTATION"));
assert.ok(types.has("WEBHOOK_DOCUMENTATION"));
assert.ok(types.has("ERROR_HANDLING_DOCUMENTATION"));
assert.ok(types.has("RETRY_DOCUMENTATION"));
assert.ok(types.has("IDEMPOTENCY_DOCUMENTATION"));
assert.ok(types.has("ENVIRONMENT_DOCUMENTATION"));
assert.ok(types.has("API_REFERENCE_DOCUMENTATION"));
assert.ok(types.has("SECURITY_DOCUMENTATION"));

// --------------------------------------------------
// Source reference validation
// --------------------------------------------------

for (const item of result.evidence) {
  assert.ok(item.source.file);

  assert.ok(
    Number.isInteger(item.source.line),
  );

  assert.ok(
    Number.isInteger(item.source.endLine),
  );

  assert.ok(item.source.line >= 1);

  assert.ok(
    item.source.endLine >= item.source.line,
  );
}

// --------------------------------------------------
// Evidence contract validation
// --------------------------------------------------

for (const item of result.evidence) {
  assert.equal(
    item.interpretation,
    "DOCUMENTATION_STATEMENT",
  );

  assert.equal(item.confidence, "HIGH");

  assert.ok(item.value.excerpt);

  assert.ok(
    item.value.excerpt.length <= 500,
  );

  assert.ok(
    Array.isArray(item.limitations),
  );
}

// --------------------------------------------------
// Secret redaction
// --------------------------------------------------

const secretResult = extractDocumentationEvidence([
  {
    relativePath: "docs/security.md",
    content: `
# Authentication

Use OAuth 2.0 authentication.

client_secret = "super-secret-value"
access_token = "example-access-token"
Authorization: Bearer abcdef123456789
`,
  },
]);

const serializedResult = JSON.stringify(secretResult);

assert.ok(
  !serializedResult.includes("super-secret-value"),
);

assert.ok(
  !serializedResult.includes("example-access-token"),
);

assert.ok(
  !serializedResult.includes("abcdef123456789"),
);

// --------------------------------------------------
// Unsupported files
// --------------------------------------------------

const unsupportedResult = extractDocumentationEvidence([
  {
    relativePath: "src/payment.js",
    content: "createPayment();",
  },
]);

assert.equal(
  unsupportedResult.summary.filesProcessed,
  0,
);

assert.equal(
  unsupportedResult.summary.filesSkipped,
  1,
);

// --------------------------------------------------
// Unsafe path
// --------------------------------------------------

const unsafePathResult = extractDocumentationEvidence([
  {
    relativePath: "../docs/payment.md",
    content: "Payment integration.",
  },
]);

assert.equal(
  unsafePathResult.summary.filesProcessed,
  0,
);

assert.equal(
  unsafePathResult.summary.filesSkipped,
  1,
);

assert.equal(
  unsafePathResult.errors[0].type,
  "FILE_PROCESSING_ERROR",
);

// --------------------------------------------------
// Duplicate paths
// --------------------------------------------------

const duplicatePathResult = extractDocumentationEvidence([
  {
    relativePath: "docs/payment.md",
    content: "Payment integration.",
  },
  {
    relativePath: "DOCS/PAYMENT.MD",
    content: "Webhook integration.",
  },
]);

assert.equal(
  duplicatePathResult.summary.filesProcessed,
  1,
);

assert.equal(
  duplicatePathResult.summary.filesSkipped,
  1,
);

assert.equal(
  duplicatePathResult.errors[0].type,
  "FILE_PROCESSING_ERROR",
);

// --------------------------------------------------
// Oversized file
// --------------------------------------------------

const oversizedResult = extractDocumentationEvidence([
  {
    relativePath: "docs/large.md",
    content: "a".repeat(1_000_001),
  },
]);

assert.equal(
  oversizedResult.summary.filesProcessed,
  0,
);

assert.equal(
  oversizedResult.summary.filesSkipped,
  1,
);

assert.match(
  oversizedResult.errors[0].message,
  /exceeds the/,
);

// --------------------------------------------------
// Invalid input
// --------------------------------------------------

assert.throws(
  () => extractDocumentationEvidence("invalid"),
  /expects an array/,
);

// --------------------------------------------------
// Evidence limit boundary
// --------------------------------------------------

// --------------------------------------------------
// Evidence limit boundary
// --------------------------------------------------

const largeDocumentation = Array.from(
  { length: 2_000 },
  () =>
    "Process payment using OAuth 2.0 authentication; " +
    "verify webhook signature; " +
    "use exponential backoff for retryable failures; " +
    "include an idempotency key; " +
    "use HTTPS for secure communication.",
).join("\n");

const evidenceLimitResult =
  extractDocumentationEvidence([
    {
      relativePath: "docs/large.md",
      content: largeDocumentation,
    },
  ]);

assert.equal(
  evidenceLimitResult.evidence.length,
  10_000,
  "Evidence must never exceed 10,000 records.",
);

assert.equal(
  evidenceLimitResult.summary.evidenceCount,
  10_000,
);

assert.equal(
  evidenceLimitResult.summary.evidenceLimitReached,
  true,
);

console.log("Documentation evidence limit test passed.");