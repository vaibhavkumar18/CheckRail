import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import interpretIntegration from "../features/interpretation/services/interpretation.service.js";
import { extractEvidence } from "../features/Ingestion/Evidence/evidenceExtractor.js";

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const createManifestEntry = (relativePath, content) => ({
  relativePath,
  size: Buffer.byteLength(content),
  sha256: sha256(Buffer.from(content)),
});

const findOperation = (operations, { operationType, method, name }) =>
  operations.find(
    (operation) =>
      operation.operationType === operationType &&
      operation.method === method &&
      (name === undefined || operation.name === name),
  );

const getEvidenceIdSet = (operation) => new Set(operation?.evidenceIds ?? []);

const assertDisjointEvidence = (first, second, message) => {
  const firstIds = getEvidenceIdSet(first);
  const secondIds = getEvidenceIdSet(second);

  for (const evidenceId of firstIds) {
    assert.equal(
      secondIds.has(evidenceId),
      false,
      `${message}: evidence ${evidenceId} was shared`,
    );
  }
};

const run = async () => {
  const extractionDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "corridorgate-evidence-test-"),
  );

  try {
    // --------------------------------------------------
    // Test Fixtures
    // --------------------------------------------------

    const fixtures = {
      "openapi/payouts.openapi.json": JSON.stringify({
        openapi: "3.0.0",

        info: {
          title: "Payout API",
          version: "1.0.0",
        },

        servers: [
          {
            url: "https://api.example.com",
          },
        ],

        paths: {
          "/v1/payouts": {
            post: {
              operationId: "createPayout",
              summary: "Create payout",

              parameters: [
                {
                  name: "Idempotency-Key",
                  in: "header",
                  required: true,
                  schema: {
                    type: "string",
                  },
                },
              ],

              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        amount: {
                          type: "number",
                        },
                        currency: {
                          type: "string",
                        },
                      },
                    },
                  },
                },
              },

              security: [
                {
                  bearerAuth: [],
                },
              ],

              responses: {
                201: {
                  description: "Payout created",
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

            get: {
              operationId: "listPayouts",
              summary: "List payouts",

              parameters: [
                {
                  name: "limit",
                  in: "query",
                  required: false,
                  schema: {
                    type: "integer",
                  },
                },
              ],

              responses: {
                200: {
                  description: "Payout list returned",
                  content: {
                    "application/json": {
                      schema: {
                        type: "array",
                        items: {
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
          },
        },

        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
            },
          },
        },
      }),

      "src/payoutClient.js": `
        import axios from "axios";

        export const createPayout = async (url, payload) => {
          return axios.post(url, payload, {
            headers: {
              Authorization: "Bearer token"
            }
          });
        };

        export const getPayouts = async (statusUrl) => {
          return axios.get(statusUrl, {
            headers: {
              "X-Request-ID": "request-123"
            }
          });
        };
      `,

      "src/config.js": `
        export const config = {
          baseURL: process.env.PAYPAL_BASE_URL,
          timeout: 5000
        };
      `,

      ".env.example": `
        PAYPAL_BASE_URL=https://api.example.com
        PAYPAL_CLIENT_ID=
        PAYPAL_CLIENT_SECRET=
      `,

      "README.md": `
        # Payment Integration

        Include an idempotency key in payment requests.

        Configure OAuth authentication before making payment requests.
      `,
    };

    const manifest = [];

    for (const [relativePath, content] of Object.entries(fixtures)) {
      const destination = path.join(extractionDir, ...relativePath.split("/"));

      await fs.mkdir(path.dirname(destination), {
        recursive: true,
      });

      const buffer = Buffer.from(content);

      await fs.writeFile(destination, buffer);

      manifest.push({
        relativePath,
        size: buffer.length,
        sha256: sha256(buffer),
      });
    }

    // --------------------------------------------------
    // Evidence Extraction Test
    // --------------------------------------------------

    console.log("\n========== EVIDENCE EXTRACTION TEST ==========");

    const result = await extractEvidence({
      extractionDir,
      manifest,
    });

    assert.equal(result.success, true);
    assert.equal(result.processingStatus, "COMPLETED");
    assert.equal(result.files.manifestFileCount, 5);
    assert.equal(result.files.verifiedTextFileCount, 5);
    assert.equal(result.extraction.openApiSpecifications, 1);

    const evidence = result.normalizedEvidence.evidence;
    const authenticationEvidence = evidence
      .filter((item) =>
        [
          "AUTHORIZATION_HEADER",
          "AUTHENTICATION_CONFIGURATION",
          "TOKEN_REFERENCE",
          "API_SECURITY_SCHEME",
          "API_OPERATION_SECURITY",
          "API_GLOBAL_SECURITY",
        ].includes(item.evidenceType),
      )
      .map((item) => ({
        evidenceType: item.evidenceType,
        subject: item.subject,
        value: item.value,
        source: item.source,
        evidenceId: item.evidenceId,
      }));

    console.log("\n========== AUTHENTICATION EVIDENCE ==========");

    console.dir(authenticationEvidence, {
      depth: null,
      colors: true,
    });
    assert.ok(evidence.length > 0);

    const evidenceTypes = new Set(evidence.map((item) => item.evidenceType));

    assert.ok(evidenceTypes.has("API_OPERATION"));
    assert.ok(evidenceTypes.has("HTTP_REQUEST"));
    assert.ok(evidenceTypes.has("API_RESPONSE"));
    assert.ok(evidenceTypes.has("ENVIRONMENT_VARIABLE_REFERENCE"));
    assert.ok(evidenceTypes.has("IDEMPOTENCY_DOCUMENTATION"));

    // Every evidence record must retain source provenance.
    for (const item of evidence) {
      assert.ok(item.source);
      assert.ok(item.source.file);
      assert.ok(item.evidenceId);
    }

    console.log("Evidence extraction passed.");

    console.log({
      evidenceCount: result.normalizedEvidence.summary.normalizedEvidenceCount,

      evidenceByType: result.normalizedEvidence.summary.evidenceByType,

      extraction: result.extraction,

      errors: result.errors.length,
    });

    // --------------------------------------------------
    // Manifest Integrity Test
    // --------------------------------------------------

    console.log("\n========== MANIFEST INTEGRITY TEST ==========");

    const configPath = path.join(extractionDir, "src", "config.js");

    // Tamper with a file and verify that it is rejected.
    await fs.appendFile(configPath, "\n// modified");

    const tamperedResult = await extractEvidence({
      extractionDir,
      manifest,
    });

    assert.equal(tamperedResult.processingStatus, "COMPLETED_WITH_ERRORS");

    assert.ok(
      tamperedResult.errors.some(
        (error) => error.type === "FILE_VERIFICATION_ERROR",
      ),
    );

    console.log("Manifest integrity test passed.");

    // --------------------------------------------------
    // Interpretation Service Integration Test
    // --------------------------------------------------

    console.log("\n========== INTERPRETATION TEST ==========");

    const interpretationResult = await interpretIntegration({
      integrationId: "test-integration-001",

      normalizedEvidence: result.normalizedEvidence,

      metadata: {
        name: "Test Payout Integration",
        description: "Test payment integration for CorridorGate",
      },
    });

    console.log("Interpretation Status:", interpretationResult.status);

    const profile = interpretationResult.profile;
    console.log("\n========== AUTHENTICATION PROFILE ==========");

    console.dir(
      {
        method: profile.authentication.method,
        tokenEndpoint: profile.authentication.tokenEndpoint,
        tokenAcquisition: profile.authentication.tokenAcquisition,
        tokenRefresh: profile.authentication.tokenRefresh,

        description: profile.authentication.description,
        assessment: profile.authentication.assessment,
        confidence: profile.authentication.confidence,
        evidenceIds: profile.authentication.evidenceIds,
        limitations: profile.authentication.limitations,
      },
      { depth: null },
    );
    assert.equal(
      profile.authentication.method,
      "HTTP Bearer (OpenAPI declaration)",
    );

    assert.equal(profile.authentication.tokenEndpoint, null);
    assert.equal(profile.authentication.tokenAcquisition, null);
    assert.equal(profile.authentication.tokenRefresh, null);

    assert.equal(profile.authentication.assessment, "INFERRED");
    assert.equal(profile.authentication.confidence, "LOW");

    assert.equal(profile.authentication.evidenceIds.length, 4);
    assert.ok(profile, "Integration Profile should be generated.");

    assert.equal(
      profile.apiOperations.length,
      4,
      "Expected two source-code requests and two OpenAPI operations.",
    );

    console.log("Interpretation Summary:", {
      success: interpretationResult.success,
      evidenceCount: evidence.length,
      provider: profile.provider?.name,
      integrationType: profile.integration?.type,
      capabilities: profile.capabilities?.length,
      apiOperations: profile.apiOperations.length,
    });

    // --------------------------------------------------
    // API Operation Correlation Tests
    // --------------------------------------------------

    console.log("\n========== API OPERATION CORRELATION TESTS ==========");

    const operations = profile.apiOperations;

    // --------------------------------------------------
    // 1. OpenAPI operation separation
    // --------------------------------------------------

    const createPayout = findOperation(operations, {
      operationType: "SPECIFICATION_DECLARATION",
      method: "POST",
      name: "createPayout",
    });

    const listPayouts = findOperation(operations, {
      operationType: "SPECIFICATION_DECLARATION",
      method: "GET",
      name: "listPayouts",
    });

    assert.ok(
      createPayout,
      "OpenAPI POST createPayout operation should exist.",
    );

    assert.ok(listPayouts, "OpenAPI GET listPayouts operation should exist.");

    assertDisjointEvidence(
      createPayout,
      listPayouts,
      "OpenAPI operations must not share evidence",
    );

    console.log("PASS: OpenAPI operations are separated.");

    // --------------------------------------------------
    // 2. OpenAPI request parameter correlation
    // --------------------------------------------------

    assert.ok(
      createPayout.request,
      "createPayout should contain request information.",
    );

    assert.ok(
      listPayouts.request,
      "listPayouts should contain request information.",
    );

    const createRequestText = JSON.stringify(createPayout.request);
    const listRequestText = JSON.stringify(listPayouts.request);

    assert.ok(
      createRequestText.includes("Idempotency-Key"),
      "Idempotency-Key should belong to createPayout.",
    );

    assert.ok(
      listRequestText.includes("limit"),
      "limit should belong to listPayouts.",
    );

    assert.equal(
      listRequestText.includes("Idempotency-Key"),
      false,
      "createPayout parameter must not leak into listPayouts.",
    );

    assert.equal(
      createRequestText.includes('"limit"'),
      false,
      "listPayouts parameter must not leak into createPayout.",
    );

    console.log("PASS: OpenAPI parameters are correlated.");

    // --------------------------------------------------
    // 3. OpenAPI request body correlation
    // --------------------------------------------------

    assert.ok(
      createRequestText.includes("amount"),
      "createPayout request body should contain amount.",
    );

    assert.ok(
      createRequestText.includes("currency"),
      "createPayout request body should contain currency.",
    );

    assert.equal(
      listRequestText.includes("amount"),
      false,
      "createPayout body must not leak into listPayouts.",
    );

    console.log("PASS: OpenAPI request body is correlated.");

    // --------------------------------------------------
    // 4. OpenAPI response correlation
    // --------------------------------------------------

    assert.ok(
      createPayout.response,
      "createPayout should contain response information.",
    );

    assert.ok(
      listPayouts.response,
      "listPayouts should contain response information.",
    );

    const createResponseText = JSON.stringify(createPayout.response);
    const listResponseText = JSON.stringify(listPayouts.response);

    assert.ok(
      createResponseText.includes("201"),
      "201 response should belong to createPayout.",
    );

    assert.ok(
      listResponseText.includes("200"),
      "200 response should belong to listPayouts.",
    );

    assert.equal(
      createResponseText.includes('"200"'),
      false,
      "listPayouts response must not leak into createPayout.",
    );

    assert.equal(
      listResponseText.includes('"201"'),
      false,
      "createPayout response must not leak into listPayouts.",
    );

    console.log("PASS: OpenAPI responses are correlated.");

    // --------------------------------------------------
    // 5. OpenAPI security correlation
    // --------------------------------------------------

    assert.ok(
      createPayout.authentication,
      "createPayout should contain declared security requirements.",
    );

    assert.equal(
      createPayout.authentication.declared,
      true,
      "createPayout security should be marked as declared.",
    );

    assert.ok(
      createPayout.authentication.evidenceIds.length > 0,
      "createPayout security should retain evidence IDs.",
    );

    assert.equal(
      listPayouts.authentication,
      null,
      "listPayouts has no operation-level security requirement.",
    );

    console.log("PASS: OpenAPI security is correlated.");

    // --------------------------------------------------
    // 6. Source-code request separation
    // --------------------------------------------------

    const sourcePost = findOperation(operations, {
      operationType: "SOURCE_HTTP_REQUEST",
      method: "POST",
    });

    const sourceGet = findOperation(operations, {
      operationType: "SOURCE_HTTP_REQUEST",
      method: "GET",
    });

    assert.ok(sourcePost, "Source-code Axios POST request should exist.");

    assert.ok(sourceGet, "Source-code Axios GET request should exist.");

    assertDisjointEvidence(
      sourcePost,
      sourceGet,
      "Source-code requests must not share evidence",
    );

    console.log("PASS: Source-code requests are separated.");

    // --------------------------------------------------
    // 7. Source-code header correlation
    // --------------------------------------------------

    assert.ok(
      sourcePost.request?.headers?.includes("Authorization"),
      "Authorization header should belong to the POST request.",
    );

    assert.ok(
      sourceGet.request?.headers?.includes("X-Request-ID"),
      "X-Request-ID should belong to the GET request.",
    );

    assert.equal(
      sourceGet.request?.headers?.includes("Authorization"),
      false,
      "Authorization header must not leak into the GET request.",
    );

    assert.equal(
      sourcePost.request?.headers?.includes("X-Request-ID"),
      false,
      "X-Request-ID must not leak into the POST request.",
    );

    console.log("PASS: Source-code headers are correlated.");

    // --------------------------------------------------
    // 8. Source-code authentication separation
    // --------------------------------------------------

    assert.ok(
      sourcePost.authentication?.detected,
      "POST request should detect Authorization evidence.",
    );

    assert.ok(
      sourcePost.authentication.evidenceIds.length > 0,
      "POST authentication should retain evidence IDs.",
    );

    assert.equal(
      sourceGet.authentication,
      null,
      "GET request without Authorization evidence should have null authentication.",
    );

    console.log("PASS: Source-code authentication is separated.");

    console.log("\nAll API operation correlation assertions passed.");

    // --------------------------------------------------
    // Evidence Verification
    // --------------------------------------------------

    console.log("\n========== VERIFICATION SUMMARY ==========");

    const verification = interpretationResult.verification;

    assert.ok(verification, "Evidence verification result should exist.");

    console.log({
      status: verification.status,
      success: verification.success,
      errors: verification.errors.length,
      warnings: verification.warnings.length,
      summary: verification.summary,
    });

    if (verification.errors.length > 0) {
      console.error("\nVerification errors:");
      console.dir(verification.errors, {
        depth: null,
      });
    }

    if (verification.warnings.length > 0) {
      console.warn("\nVerification warnings:");
      console.dir(verification.warnings, {
        depth: null,
      });
    }

    assert.ok(
      ["PASSED", "PASSED_WITH_WARNINGS"].includes(verification.status),
      "Interpretation evidence verification should pass.",
    );

    assert.equal(
      verification.errors.length,
      0,
      "Interpretation should not contain evidence verification errors.",
    );

    // --------------------------------------------------
    // Final Result
    // --------------------------------------------------

    console.log("\n========== FINAL TEST RESULT ==========");

    console.log({
      evidenceExtraction: "PASSED",
      manifestIntegrity: "PASSED",
      interpretation: interpretationResult.status,
      apiOperationCorrelation: "PASSED",
      evidenceVerification: verification.status,
      totalEvidence: evidence.length,
      totalApiOperations: operations.length,
    });

    console.log("\nInterpretation integration test completed.");
  } finally {
    await fs.rm(extractionDir, {
      recursive: true,
      force: true,
    });
  }
};

run().catch((error) => {
  console.error("Evidence extractor tests failed:", error);

  process.exitCode = 1;
});
