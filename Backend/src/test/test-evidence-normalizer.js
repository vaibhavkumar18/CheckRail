import assert from "node:assert/strict";

import {
  normalizeEvidence,
} from "../features/Ingestion/Evidence/evidenceNormalizer.js";

// --------------------------------------------------
// Mock code extractor result
// --------------------------------------------------

const codeResult = {
  evidenceType: "SOURCE_CODE",

  extractor: {
    name: "CODE_EXTRACTOR",
    version: "1.0.0",
    parser: "@babel/parser",
  },

  summary: {
    totalFiles: 1,
    filesProcessed: 1,
    filesSkipped: 0,
    evidenceCount: 2,
    errorCount: 0,
  },

  evidence: [
    {
      evidenceType: "HTTP_REQUEST",
      subject: "AXIOS",
      value: {
        client: "AXIOS",
        method: "POST",
        urlExpression: "paymentUrl",
      },
      interpretation: "DIRECT_OBSERVATION",
      confidence: "HIGH",
      source: {
        file: "src/paymentClient.js",
        line: 10,
        column: 2,
        endLine: 10,
        endColumn: 30,
      },
      limitations: [
        "Request expressions are statically described.",
      ],
    },

    {
      evidenceType: "AUTHORIZATION_HEADER",
      subject: "HTTP_AUTHORIZATION",
      value: {
        headerName: "Authorization",
      },
      interpretation: "DIRECT_OBSERVATION",
      confidence: "HIGH",
      source: {
        file: "src/paymentClient.js",
        line: 15,
        column: 4,
        endLine: 15,
        endColumn: 25,
      },
      limitations: [
        "Header presence does not prove valid authentication.",
      ],
    },
  ],

  errors: [],
  limitations: [
    "Static analysis only.",
  ],
};

// --------------------------------------------------
// Mock config extractor result
// --------------------------------------------------

const configResult = {
  evidenceType: "CONFIGURATION",

  extractor: {
    name: "CONFIG_EXTRACTOR",
    version: "1.0.0",
    parser: "@babel/parser",
  },

  summary: {
    totalFiles: 1,
    filesProcessed: 1,
    filesSkipped: 0,
    evidenceCount: 1,
    errorCount: 0,
  },

  evidence: [
    {
      evidenceType: "AUTHENTICATION_CONFIGURATION",
      subject: "clientSecret",
      value: {
        expression: "<redacted>",
      },
      interpretation: "DIRECT_OBSERVATION",
      confidence: "HIGH",
      source: {
        file: "src/config.js",
        line: 5,
        column: 2,
        endLine: 5,
        endColumn: 30,
      },
      limitations: [
        "Credential values are never extracted.",
      ],
    },
  ],

  errors: [],
  limitations: [],
};

// --------------------------------------------------
// Mock documentation extractor result
// --------------------------------------------------

const documentationResult = {
  evidenceType: "DOCUMENTATION",

  extractor: {
    name: "DOCUMENTATION_EXTRACTOR",
    version: "1.0.0",
    parser: "LINE_BASED_DOCUMENTATION_PARSER",
  },

  summary: {
    totalFiles: 1,
    filesProcessed: 1,
    filesSkipped: 0,
    evidenceCount: 1,
    errorCount: 0,
  },

  evidence: [
    {
      evidenceType: "IDEMPOTENCY_DOCUMENTATION",
      subject: "Payment Idempotency",
      value: {
        excerpt: "Include an idempotency key in payment requests.",
      },
      interpretation: "DOCUMENTATION_STATEMENT",
      confidence: "HIGH",
      source: {
        file: "README.md",
        line: 12,
        endLine: 12,
      },
      limitations: [
        "Documentation does not prove actual implementation.",
      ],
    },
  ],

  errors: [],
  limitations: [],
};

// --------------------------------------------------
// Mock OpenAPI result
// --------------------------------------------------

const openApiResult = {
  evidenceType: "API_SPECIFICATION",
  specificationVersion: "OPENAPI_3",

  specification: {
    title: "Payment API",
    version: "1.0.0",
    description: "Payment API specification.",
  },

  source: {
    file: "openapi/payment.json",
    format: "PARSED_API_SPECIFICATION",
  },

  servers: [
    {
      url: "https://api.example.com",
      description: "Production API",
      variables: {},
      sourceReference: "$.servers[0]",
    },
  ],

  securitySchemes: [
    {
      name: "OAuth2",
      type: "oauth2",
      scheme: null,
      flows: {
        clientCredentials: {
          tokenUrl: "https://api.example.com/oauth/token",
          scopes: {},
        },
      },
      sourceReference: null,
    },
  ],

  globalSecurity: [
    {
      alternative: 1,
      schemes: [
        {
          schemeName: "OAuth2",
          scopes: [],
        },
      ],
    },
  ],

  operations: [
    {
      path: "/v1/payments",
      method: "POST",
      operationId: "createPayment",
      summary: "Create a payment",
      description: null,
      tags: ["Payments"],
      deprecated: false,

      parameters: [
        {
          name: "Idempotency-Key",
          in: "header",
          required: false,
          type: "string",
          sourceReference:
            "$.paths['/v1/payments'].post.parameters[0]",
        },
      ],

      requestBody: {
        required: true,
        content: [
          {
            mediaType: "application/json",
            schema: {
              type: "object",
            },
          },
        ],
        sourceReference:
          "$.paths['/v1/payments'].post.requestBody",
      },

      responses: [
        {
          statusCode: "201",
          description: "Created",
          headers: [],
          content: [],
          sourceReference:
            "$.paths['/v1/payments'].post.responses['201']",
        },
      ],

      security: {
        source: "GLOBAL",
        requirements: [
          {
            alternative: 1,
            schemes: [
              {
                schemeName: "OAuth2",
                scopes: [],
              },
            ],
          },
        ],
      },

      sourceReference: "$.paths['/v1/payments'].post",
    },
  ],

  summary: {
    endpointCount: 1,
    methods: ["POST"],
    securitySchemeCount: 1,
  },
};

// --------------------------------------------------
// Main normalization test
// --------------------------------------------------

const result = normalizeEvidence({
  openApi: openApiResult,
  code: codeResult,
  config: configResult,
  documentation: documentationResult,
});

assert.equal(result.schemaVersion, "1.0.0");

assert.ok(Array.isArray(result.evidence));

assert.ok(result.evidence.length > 0);

assert.equal(
  result.summary.normalizedEvidenceCount,
  result.evidence.length,
);

// --------------------------------------------------
// Evidence categories
// --------------------------------------------------

const types = new Set(
  result.evidence.map((item) => item.evidenceType),
);

assert.ok(types.has("API_SPECIFICATION_METADATA"));
assert.ok(types.has("API_SERVER"));
assert.ok(types.has("API_SECURITY_SCHEME"));
assert.ok(types.has("API_GLOBAL_SECURITY"));
assert.ok(types.has("API_OPERATION"));
assert.ok(types.has("API_OPERATION_PARAMETER"));
assert.ok(types.has("API_REQUEST_BODY"));
assert.ok(types.has("API_RESPONSE"));

assert.ok(types.has("HTTP_REQUEST"));
assert.ok(types.has("AUTHORIZATION_HEADER"));
assert.ok(types.has("AUTHENTICATION_CONFIGURATION"));
assert.ok(types.has("IDEMPOTENCY_DOCUMENTATION"));

// --------------------------------------------------
// Normalized contract validation
// --------------------------------------------------

for (const item of result.evidence) {
  assert.ok(item.evidenceId.startsWith("ev_"));

  assert.ok(item.evidenceType);

  assert.ok(item.sourceCategory);

  assert.ok(item.sourceExtractor);

  assert.ok(
    ["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(
      item.confidence,
    ),
  );

  assert.ok(item.source);

  assert.ok(Array.isArray(item.limitations));

  assert.ok(
    ["DIRECT_OBSERVATION", "DOCUMENTATION_STATEMENT",
      "INFERRED", "UNKNOWN", "UNSPECIFIED"].includes(
      item.interpretation,
    ),
  );
}

// --------------------------------------------------
// Provenance validation
// --------------------------------------------------

const operationEvidence = result.evidence.find(
  (item) => item.evidenceType === "API_OPERATION",
);

assert.equal(
  operationEvidence.source.file,
  "openapi/payment.json",
);

assert.equal(
  operationEvidence.source.reference,
  "$.paths['/v1/payments'].post",
);

const codeEvidence = result.evidence.find(
  (item) => item.evidenceType === "HTTP_REQUEST",
);

assert.equal(
  codeEvidence.source.file,
  "src/paymentClient.js",
);

assert.equal(codeEvidence.source.line, 10);

// --------------------------------------------------
// Documentation classification
// --------------------------------------------------

const documentationEvidence = result.evidence.find(
  (item) =>
    item.evidenceType === "IDEMPOTENCY_DOCUMENTATION",
);

assert.equal(
  documentationEvidence.sourceCategory,
  "DOCUMENTATION",
);

assert.equal(
  documentationEvidence.interpretation,
  "DOCUMENTATION_STATEMENT",
);

// --------------------------------------------------
// OpenAPI declaration limitation
// --------------------------------------------------

assert.ok(
  operationEvidence.limitations.some((item) =>
    item.includes("does not prove"),
  ),
);

// --------------------------------------------------
// Deterministic evidence IDs
// --------------------------------------------------

const secondResult = normalizeEvidence({
  openApi: openApiResult,
  code: codeResult,
  config: configResult,
  documentation: documentationResult,
});

assert.deepEqual(
  result.evidence.map((item) => item.evidenceId),
  secondResult.evidence.map((item) => item.evidenceId),
);

// --------------------------------------------------
// Missing extractors
// --------------------------------------------------

const partialResult = normalizeEvidence({
  code: codeResult,
});

assert.equal(
  partialResult.extractors.openApi.provided,
  false,
);

assert.equal(
  partialResult.extractors.code.provided,
  true,
);

// --------------------------------------------------
// Error propagation
// --------------------------------------------------

const errorResult = normalizeEvidence({
  code: {
    ...codeResult,
    errors: [
      {
        file: "src/broken.js",
        type: "PARSE_ERROR",
        message: "Unexpected token.",
        line: 5,
        column: 2,
      },
    ],
  },
});

assert.equal(errorResult.summary.errorCount, 1);

assert.equal(
  errorResult.errors[0].file,
  "src/broken.js",
);

assert.equal(
  errorResult.errors[0].sourceExtractor,
  "CODE_EXTRACTOR",
);

// --------------------------------------------------
// Invalid input
// --------------------------------------------------

assert.throws(
  () => normalizeEvidence({
    code: "invalid",
  }),
  /result must be an object/,
);

assert.throws(
  () => normalizeEvidence({
    code: {
      evidence: "invalid",
    },
  }),
  /must contain an evidence array/,
);

// --------------------------------------------------
// Confidence is not upgraded
// --------------------------------------------------

const lowConfidenceResult = normalizeEvidence({
  documentation: {
    ...documentationResult,
    evidence: [
      {
        ...documentationResult.evidence[0],
        confidence: "LOW",
        interpretation: "INFERRED",
      },
    ],
  },
});

assert.equal(
  lowConfidenceResult.evidence[0].confidence,
  "LOW",
);

assert.equal(
  lowConfidenceResult.evidence[0].interpretation,
  "INFERRED",
);

// --------------------------------------------------
// Duplicate handling
// --------------------------------------------------

const duplicateCodeResult = {
  ...codeResult,
  evidence: [
    ...codeResult.evidence,
    codeResult.evidence[0],
  ],
};

const duplicateResult = normalizeEvidence({
  code: duplicateCodeResult,
});

assert.equal(
  duplicateResult.summary.duplicateEvidenceRemoved,
  1,
);

assert.equal(
  duplicateResult.summary.normalizedEvidenceCount,
  2,
);

// --------------------------------------------------
// Explicit operation-level security: []
// --------------------------------------------------

const operationWithoutSecurity = {
  ...openApiResult,
  globalSecurity: [],
  operations: [
    {
      ...openApiResult.operations[0],
      security: {
        source: "OPERATION",
        requirements: [],
      },
    },
  ],
};

const securityResult = normalizeEvidence({
  openApi: operationWithoutSecurity,
});

const operationSecurityEvidence =
  securityResult.evidence.find(
    (item) =>
      item.evidenceType === "API_OPERATION_SECURITY",
  );

assert.ok(operationSecurityEvidence);

assert.deepEqual(
  operationSecurityEvidence.value.requirements,
  [],
);

console.log("Evidence normalizer tests passed.");