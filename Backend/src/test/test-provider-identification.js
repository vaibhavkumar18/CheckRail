import assert from "node:assert/strict";

import analyzeIntegration from "../features/interpretation/services/integrationAnalyzer.js";

// --------------------------------------------------
// Test Helpers
// --------------------------------------------------

const createEvidence = ({
  evidenceId,
  evidenceType,
  sourceCategory,
  subject,
  value,
}) => ({
  evidenceId,
  evidenceType,
  sourceCategory,
  source: {
    file: "test/paymentClient.js",
  },
  subject,
  value,
});

const createGroupedEvidence = (evidence = []) => ({
  groups: {
    PROVIDER_TEST_GROUP: evidence,
  },
});

const identifyProvider = (evidence) => {
  const result = analyzeIntegration(createGroupedEvidence(evidence));

  return result.provider;
};

// --------------------------------------------------
// Test Cases
// --------------------------------------------------

const tests = [];

// 1. PayPal identified through source-code URL

tests.push({
  name: "Identifies PayPal from a source-code HTTP request",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "paypal-http-001",
        evidenceType: "HTTP_REQUEST",
        sourceCategory: "SOURCE_CODE",
        subject: "POST request",
        value: {
          url: "https://api-m.paypal.com/v1/payments/payouts",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, "PAYPAL");
    assert.equal(provider.identificationStatus, "IDENTIFIED");
    assert.equal(provider.confidence, "HIGH");

    assert.deepEqual(provider.evidenceIds, ["paypal-http-001"]);

    assert.deepEqual(provider.alternatives, []);
  },
});

// 2. Hyperwallet identified through source-code URL

tests.push({
  name: "Identifies Hyperwallet from a source-code HTTP request",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "hyperwallet-http-001",
        evidenceType: "HTTP_REQUEST",
        sourceCategory: "SOURCE_CODE",
        subject: "POST request",
        value: {
          url: "https://api.hyperwallet.com/rest/v3/programs",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, "HYPERWALLET");
    assert.equal(provider.identificationStatus, "IDENTIFIED");
    assert.equal(provider.confidence, "HIGH");

    assert.deepEqual(provider.evidenceIds, ["hyperwallet-http-001"]);

    assert.deepEqual(provider.alternatives, []);
  },
});

// 3. PayPal identified through configuration only

tests.push({
  name: "Returns POSSIBLE for PayPal configuration-only evidence",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "paypal-config-001",
        evidenceType: "ENVIRONMENT_VARIABLE_DECLARATION",
        sourceCategory: "CONFIGURATION",
        subject: "PAYPAL_CLIENT_ID",
        value: {
          name: "PAYPAL_CLIENT_ID",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, "PAYPAL");
    assert.equal(provider.identificationStatus, "POSSIBLE");
    assert.equal(provider.confidence, "LOW");

    assert.deepEqual(provider.evidenceIds, ["paypal-config-001"]);
  },
});

// 4. Conflicting PayPal and Hyperwallet evidence

tests.push({
  name: "Does not arbitrarily select a provider when evidence conflicts",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "paypal-http-002",
        evidenceType: "HTTP_REQUEST",
        sourceCategory: "SOURCE_CODE",
        subject: "POST request",
        value: {
          url: "https://api-m.paypal.com/v1/payments/payouts",
        },
      }),

      createEvidence({
        evidenceId: "hyperwallet-config-001",
        evidenceType: "ENVIRONMENT_VARIABLE_DECLARATION",
        sourceCategory: "CONFIGURATION",
        subject: "HYPERWALLET_PROGRAM_TOKEN",
        value: {
          name: "HYPERWALLET_PROGRAM_TOKEN",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, null);
    assert.equal(provider.identificationStatus, "POSSIBLE");
    assert.equal(provider.confidence, "LOW");

    assert.deepEqual([...provider.alternatives].sort(), [
      "HYPERWALLET",
      "PAYPAL",
    ]);

    assert.deepEqual([...provider.evidenceIds].sort(), [
      "hyperwallet-config-001",
      "paypal-http-002",
    ]);
  },
});

// 5. Unknown third-party URL

tests.push({
  name: "Returns UNKNOWN for an unrecognized provider URL",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "unknown-http-001",
        evidenceType: "HTTP_REQUEST",
        sourceCategory: "SOURCE_CODE",
        subject: "POST request",
        value: {
          url: "https://api.example-payment.com/v1/payouts",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, null);
    assert.equal(provider.identificationStatus, "UNKNOWN");
    assert.equal(provider.confidence, "UNKNOWN");

    assert.deepEqual(provider.evidenceIds, []);
    assert.deepEqual(provider.alternatives, []);
  },
});

// 6. No provider-related evidence

tests.push({
  name: "Returns UNKNOWN when no provider evidence exists",

  run: () => {
    const evidence = [
      createEvidence({
        evidenceId: "generic-evidence-001",
        evidenceType: "PAYMENT_FUNCTION",
        sourceCategory: "SOURCE_CODE",
        subject: "processPayment",
        value: {
          functionName: "processPayment",
        },
      }),
    ];

    const provider = identifyProvider(evidence);

    assert.equal(provider.name, null);
    assert.equal(provider.identificationStatus, "UNKNOWN");
    assert.equal(provider.confidence, "UNKNOWN");

    assert.deepEqual(provider.evidenceIds, []);
    assert.deepEqual(provider.alternatives, []);
  },
});

// --------------------------------------------------
// Test Runner
// --------------------------------------------------

const runTests = () => {
  let passed = 0;
  let failed = 0;

  console.log("\n========== PROVIDER IDENTIFICATION TESTS ==========\n");

  for (const test of tests) {
    try {
      test.run();

      passed++;

      console.log(`PASS: ${test.name}`);
    } catch (error) {
      failed++;

      console.error(`FAIL: ${test.name}`);
      console.error(`      ${error.message}`);
    }
  }

  console.log("\n==================================================");
  console.log(`Total: ${tests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log("All provider identification tests passed.");
  }
};

runTests();
