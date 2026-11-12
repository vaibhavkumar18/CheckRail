import assert from "node:assert/strict";

import { extractOpenApiEvidence } from "../features/Ingestion/Evidence/extractors/openApiExtractor.js";

import { normalizeEvidence } from "../features/Ingestion/Evidence/evidenceNormalizer.js";

import analyzeIntegration from "../features/Interpretation/services/integrationAnalyzer.js";

// --------------------------------------------------
// Test helpers
// --------------------------------------------------

const createDocument = ({
  globalSecurity,
  operationSecurity,
  includeGlobalSecurity = false,
  includeOperationSecurity = false,
  includeBearerScheme = true,
  includeApiKeyScheme = true,
} = {}) => {
  const securitySchemes = {};

  if (includeBearerScheme) {
    securitySchemes.bearerAuth = {
      type: "http",
      scheme: "bearer",
    };
  }

  if (includeApiKeyScheme) {
    securitySchemes.apiKeyAuth = {
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
    };
  }

  const operation = {
    operationId: "createPayout",
    summary: "Create payout",
    responses: {
      201: {
        description: "Created",
      },
    },
  };

  if (includeOperationSecurity) {
    operation.security = operationSecurity;
  }

  const document = {
    openapi: "3.0.0",

    info: {
      title: "Security Test API",
      version: "1.0.0",
    },

    paths: {
      "/v1/payouts": {
        post: operation,
      },
    },

    components: {
      securitySchemes,
    },
  };

  if (includeGlobalSecurity) {
    document.security = globalSecurity;
  }

  return document;
};

const analyzeDocument = (document) => {
  const extracted = extractOpenApiEvidence(
    document,
    "security-test.openapi.json",
  );

  const normalized = normalizeEvidence({
    openApi: extracted,
  });

  const analysis = analyzeIntegration({
    groups: {
      openApi: normalized.evidence,
    },
  });

  const operation = analysis.apiOperations.find(
    (item) =>
      item.method === "POST" &&
      item.endpoint === "/v1/payouts",
  );

  assert.ok(operation, "Expected API operation was not found.");

  return {
    extracted,
    normalized,
    analysis,
    operation,
  };
};

const tests = [];

const test = (name, callback) => {
  tests.push({ name, callback });
};

// --------------------------------------------------
// 1. Global security inheritance
// --------------------------------------------------

test("Global Bearer security is inherited", () => {
  const { operation } = analyzeDocument(
    createDocument({
      includeGlobalSecurity: true,
      globalSecurity: [
        {
          bearerAuth: [],
        },
      ],
    }),
  );

  assert.ok(operation.authentication);

  assert.deepEqual(
    operation.authentication.requirements[0].schemes,
    [
      {
        schemeName: "bearerAuth",
        scopes: [],
      },
    ],
  );

  assert.equal(operation.authentication.declared, true);
});

// --------------------------------------------------
// 2. Operation-level security overrides global security
// --------------------------------------------------

test("Operation-level API Key overrides global Bearer", () => {
  const { operation } = analyzeDocument(
    createDocument({
      includeGlobalSecurity: true,
      globalSecurity: [
        {
          bearerAuth: [],
        },
      ],

      includeOperationSecurity: true,
      operationSecurity: [
        {
          apiKeyAuth: [],
        },
      ],
    }),
  );

  assert.ok(operation.authentication);

  assert.deepEqual(
    operation.authentication.requirements,
    [
      {
        alternative: 1,
        schemes: [
          {
            schemeName: "apiKeyAuth",
            scopes: [],
          },
        ],
      },
    ],
  );

  assert.equal(operation.authentication.declared, true);
});

// --------------------------------------------------
// 3. Empty operation security disables global security
// --------------------------------------------------

test("Operation security [] explicitly disables inherited security", () => {
  const { operation } = analyzeDocument(
    createDocument({
      includeGlobalSecurity: true,
      globalSecurity: [
        {
          bearerAuth: [],
        },
      ],

      includeOperationSecurity: true,
      operationSecurity: [],
    }),
  );

  assert.ok(operation.authentication);

  assert.equal(operation.authentication.declared, true);

  assert.deepEqual(
    operation.authentication.requirements,
    [],
  );
});

// --------------------------------------------------
// 4. Explicit empty global security
// --------------------------------------------------

test("Explicit global security [] produces no requirements", () => {
  const { operation, extracted } = analyzeDocument(
    createDocument({
      includeGlobalSecurity: true,
      globalSecurity: [],
    }),
  );

  assert.equal(
    extracted.operations[0].security.source,
    "GLOBAL",
  );

  assert.deepEqual(
    extracted.operations[0].security.requirements,
    [],
  );

  assert.equal(operation.authentication, null);
});

// --------------------------------------------------
// 5. Unresolved security scheme
// --------------------------------------------------

test("Unresolved security scheme is preserved without inventing a mechanism", () => {
  const { operation, analysis } = analyzeDocument(
    createDocument({
      includeOperationSecurity: true,
      operationSecurity: [
        {
          missingAuthScheme: [],
        },
      ],

      includeBearerScheme: false,
      includeApiKeyScheme: false,
    }),
  );

  assert.ok(operation.authentication);

  assert.deepEqual(
    operation.authentication.requirements[0].schemes,
    [
      {
        schemeName: "missingAuthScheme",
        scopes: [],
      },
    ],
  );

  assert.equal(analysis.authentication.method, null);
});

// --------------------------------------------------
// Execute tests
// --------------------------------------------------

let passed = 0;
let failed = 0;

for (const { name, callback } of tests) {
  try {
    callback();
    passed++;

    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;

    console.error(`FAIL: ${name}`);
    console.error(`  ${error.message}`);
  }
}

console.log("\n========== TEST SUMMARY ==========");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${tests.length}`);

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("\nAll OpenAPI security inheritance tests passed.");
}