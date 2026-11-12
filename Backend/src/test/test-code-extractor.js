import assert from "node:assert/strict";

import { extractCodeEvidence } from "../features/Ingestion/Evidence/extractors/codeExtractor.js";

// --------------------------------------------------
// Test fixture
// --------------------------------------------------

const source = `
import axios from "axios";

const API_URL = process.env.PAYPAL_API_URL;
const ACCESS_TOKEN = process.env.PAYPAL_ACCESS_TOKEN;

const client = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

export async function createPayout(payload) {
  try {
    const response = await client.post(
      "/v1/payments/payouts",
      payload,
      {
        headers: {
          Authorization: \`Bearer \${ACCESS_TOKEN}\`,
          "Idempotency-Key": "sensitive-test-key",
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}

async function fetchPayment() {
  return fetch("/v1/payments", {
    method: "POST",
    headers: {
      Authorization: "Bearer secret-token-value",
    },
  });
}

async function retryPayment() {
  return retryAxios(createPayout);
}
`;

// --------------------------------------------------
// Test 1: Basic extraction
// --------------------------------------------------

const result = extractCodeEvidence([
  {
    relativePath: "src/paymentClient.js",
    content: source,
  },
]);

assert.equal(result.summary.filesProcessed, 1);

assert.ok(result.summary.evidenceCount > 0);

// --------------------------------------------------
// Test 2: Axios detection
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) =>
      item.evidenceType === "HTTP_REQUEST" && item.value.client === "AXIOS",
  ),
);

// --------------------------------------------------
// Test 3: Fetch detection
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) =>
      item.evidenceType === "HTTP_REQUEST" && item.value.client === "FETCH",
  ),
);

// --------------------------------------------------
// Test 4: HTTP method extraction
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) =>
      item.evidenceType === "HTTP_REQUEST" && item.value.method === "POST",
  ),
);

// --------------------------------------------------
// Test 5: Authorization header detection
// --------------------------------------------------

assert.ok(
  result.evidence.some((item) => item.evidenceType === "AUTHORIZATION_HEADER"),
);

// --------------------------------------------------
// Test 6: Environment variable references
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) =>
      item.evidenceType === "ENVIRONMENT_VARIABLE_REFERENCE" &&
      item.subject === "PAYPAL_API_URL",
  ),
);

// --------------------------------------------------
// Test 7: Base URL configuration
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) => item.evidenceType === "BASE_URL_CONFIGURATION",
  ),
);

// --------------------------------------------------
// Test 8: Timeout detection
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) => item.evidenceType === "HTTP_TIMEOUT_CONFIGURATION",
  ),
);

// --------------------------------------------------
// Test 9: Retry detection
// --------------------------------------------------

assert.ok(
  result.evidence.some((item) => item.evidenceType === "RETRY_PATTERN"),
);

// --------------------------------------------------
// Test 10: Idempotency key detection
// --------------------------------------------------

assert.ok(
  result.evidence.some((item) => item.evidenceType === "IDEMPOTENCY_KEY"),
);

// --------------------------------------------------
// Test 11: Payment function detection
// --------------------------------------------------

assert.ok(
  result.evidence.some(
    (item) =>
      item.evidenceType === "PAYMENT_FUNCTION" &&
      item.subject === "createPayout",
  ),
);

// --------------------------------------------------
// Test 12: Error handling
// --------------------------------------------------

assert.ok(
  result.evidence.some((item) => item.evidenceType === "ERROR_HANDLING"),
);

// --------------------------------------------------
// Test 13: Source line references
// --------------------------------------------------

for (const item of result.evidence) {
  assert.ok(item.source.file);

  assert.ok(
    Number.isInteger(item.source.line),
    `Missing line reference for ${item.evidenceType}`,
  );
}

// --------------------------------------------------
// Test 14: Secret-value redaction
// --------------------------------------------------

const serializedResult = JSON.stringify(result);

assert.ok(
  !serializedResult.includes("secret-token-value"),
  "Secret token value must not appear in output.",
);

assert.ok(
  !serializedResult.includes("sensitive-test-key"),
  "Idempotency key value must not appear in output.",
);

// --------------------------------------------------
// Test 15: Invalid source
// --------------------------------------------------

const invalidResult = extractCodeEvidence([
  {
    relativePath: "src/invalid.js",
    content: "function { invalid syntax",
  },
]);

assert.equal(invalidResult.summary.filesProcessed, 0);

assert.equal(invalidResult.errors.length, 1);

assert.equal(invalidResult.errors[0].type, "PARSE_ERROR");

// --------------------------------------------------
// Test 16: Unsupported file
// --------------------------------------------------

const unsupportedResult = extractCodeEvidence([
  {
    relativePath: "src/payment.py",
    content: "def create_payment(): pass",
  },
]);

assert.equal(unsupportedResult.summary.filesSkipped, 1);

assert.equal(unsupportedResult.summary.filesProcessed, 0);

// --------------------------------------------------
// Test 17: Invalid input
// --------------------------------------------------

assert.throws(() => extractCodeEvidence(null), /expects an array/);

// --------------------------------------------------
// Test 18: Unsafe path
// --------------------------------------------------

// --------------------------------------------------
// Test 18: Unsafe path
// --------------------------------------------------

const unsafePathResult = extractCodeEvidence([
  {
    relativePath: "../payment.js",
    content: "const x = 1;",
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

assert.match(
  unsafePathResult.errors[0].message,
  /Unsafe file path/,
);

// --------------------------------------------------
// Test 19: File-size limit
// --------------------------------------------------

// --------------------------------------------------
// Test 19: File-size limit
// --------------------------------------------------

const largeFileResult = extractCodeEvidence([
  {
    relativePath: "src/large.js",
    content: "a".repeat(1_000_001),
  },
]);

assert.equal(
  largeFileResult.summary.filesProcessed,
  0,
);

assert.equal(
  largeFileResult.summary.filesSkipped,
  1,
);

assert.match(
  largeFileResult.errors[0].message,
  /exceeds the/,
);

const httpRequest = result.evidence.find(
  (item) =>
    item.evidenceType === "HTTP_REQUEST" &&
    item.value.client === "AXIOS" &&
    item.value.method === "POST",
);

assert.ok(
  httpRequest,
  "Axios POST request evidence should exist",
);

assert.equal(
  httpRequest.value.urlExpression,
  "<string>",
);

assert.equal(
  httpRequest.value.bodyExpression,
  "payload",
);

assert.equal(
  httpRequest.value.configExpression,
  "object-expression",
);


// --------------------------------------------------
// Final result
// --------------------------------------------------

console.log("Code extractor tests passed.");

console.log(JSON.stringify(result.summary, null, 2));
