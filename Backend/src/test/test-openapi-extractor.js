import assert from "node:assert/strict";

import {
  extractOpenApiEvidence,
} from "../features/Ingestion/Evidence/extractors/openApiExtractor.js";

// --------------------------------------------------
// Test 1: OpenAPI 3.0
// --------------------------------------------------

const openApiDocument = {
  openapi: "3.0.3",

  info: {
    title: "Payout API",
    version: "1.0.0",
    description: "API for creating and retrieving payouts.",
  },

  servers: [
    {
      url: "https://api.example.com",
    },
  ],

  components: {
    securitySchemes: {
      OAuth2: {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "https://api.example.com/oauth/token",
            scopes: {},
          },
        },
      },
    },

    schemas: {
      PayoutRequest: {
        type: "object",
        properties: {
          amount: {
            type: "number",
          },
          currency: {
            type: "string",
          },
          recipient: {
            type: "string",
          },
        },
      },
    },
  },

  security: [
    {
      OAuth2: [],
    },
  ],

  paths: {
    "/v1/payments/payouts": {
      post: {
        operationId: "createPayout",
        summary: "Create a payout",

        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PayoutRequest",
              },
            },
          },
        },

        responses: {
          "201": {
            description: "Payout created.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    payoutId: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    "/v1/payments/payouts/{payoutId}": {
      get: {
        operationId: "getPayout",
        summary: "Get payout details",

        parameters: [
          {
            name: "payoutId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
        ],

        responses: {
          "200": {
            description: "Payout details.",
          },
        },
      },
    },
  },
};

const openApiResult = extractOpenApiEvidence(
  openApiDocument,
  "openapi/payouts.openapi.json",
);

assert.equal(
  openApiResult.specificationVersion,
  "OPENAPI_3",
);

assert.equal(
  openApiResult.source.file,
  "openapi/payouts.openapi.json",
);

assert.equal(
  openApiResult.summary.endpointCount,
  2,
);

assert.equal(
  openApiResult.summary.securitySchemeCount,
  1,
);

assert.equal(
  openApiResult.operations[0].method,
  "POST",
);

assert.equal(
  openApiResult.operations[0].operationId,
  "createPayout",
);

assert.equal(
  openApiResult.operations[0].requestBody.required,
  true,
);

assert.equal(
  openApiResult.operations[0].security.source,
  "GLOBAL",
);

assert.equal(
  openApiResult.operations[1].method,
  "GET",
);

assert.equal(
  openApiResult.operations[1].parameters[0].name,
  "payoutId",
);

assert.equal(
  openApiResult.operations[0].sourceReference,
  "$.paths['/v1/payments/payouts'].post",
);

// --------------------------------------------------
// Test 2: Operation-level security override
// --------------------------------------------------

const overrideDocument = {
  openapi: "3.0.3",

  info: {
    title: "Security Test",
    version: "1.0.0",
  },

  security: [
    {
      GlobalAuth: [],
    },
  ],

  paths: {
    "/public": {
      get: {
        security: [],
        responses: {
          "200": {
            description: "Public response.",
          },
        },
      },
    },
  },
};

const overrideResult = extractOpenApiEvidence(
  overrideDocument,
);

assert.equal(
  overrideResult.operations[0].security.source,
  "OPERATION",
);

assert.equal(
  overrideResult.operations[0].security.requirements.length,
  0,
);

// --------------------------------------------------
// Test 3: Swagger 2.0
// --------------------------------------------------

const swaggerDocument = {
  swagger: "2.0",

  info: {
    title: "Legacy Payout API",
    version: "1.0.0",
  },

  host: "api.example.com",
  basePath: "/v1",
  schemes: ["https"],

  securityDefinitions: {
    ApiKeyAuth: {
      type: "apiKey",
      name: "Authorization",
      in: "header",
    },
  },

  paths: {
    "/payouts": {
      post: {
        operationId: "createLegacyPayout",

        parameters: [
          {
            name: "body",
            in: "body",
            required: true,
            schema: {
              type: "object",
            },
          },
        ],

        responses: {
          "200": {
            description: "Success.",
            schema: {
              type: "object",
            },
          },
        },
      },
    },
  },
};

const swaggerResult = extractOpenApiEvidence(
  swaggerDocument,
  "swagger/payouts.json",
);

assert.equal(
  swaggerResult.specificationVersion,
  "SWAGGER_2",
);

assert.equal(
  swaggerResult.operations.length,
  1,
);

assert.equal(
  swaggerResult.operations[0].requestBody.required,
  true,
);

assert.equal(
  swaggerResult.servers[0].url,
  "https://api.example.com/v1",
);

assert.equal(
  swaggerResult.securitySchemes[0].type,
  "apiKey",
);

// --------------------------------------------------
// Test 4: Invalid specification
// --------------------------------------------------

assert.throws(
  () => extractOpenApiEvidence({
    info: {
      title: "Invalid API",
    },
  }),
  /Unsupported API specification/,
);

// --------------------------------------------------
// Test 5: Invalid input
// --------------------------------------------------

assert.throws(
  () => extractOpenApiEvidence(null),
  /valid parsed object/,
);

console.log("OpenAPI extractor tests passed.");

console.log(
  JSON.stringify(openApiResult, null, 2),
);