
import assert from "node:assert/strict";
import analyzeIntegration from "../features/Interpretation/services/integrationAnalyzer.js";

const createEvidence = (evidenceType, subject, value, id) => ({
  evidenceId: id,
  evidenceType,
  sourceCategory: "API_SPECIFICATION",
  sourceExtractor: "OPENAPI_EXTRACTOR",
  subject,
  value,
  source: {
    file: "openapi/auth.openapi.json",
    format: "PARSED_API_SPECIFICATION",
  },
});

const createScheme = (name, value, id) =>
  createEvidence("API_SECURITY_SCHEME", name, {
    name,
    ...value,
  }, id);

const createSecurity = (type, requirements, id) =>
  createEvidence(
    type,
    type,
    { source: type === "API_GLOBAL_SECURITY" ? "GLOBAL" : "OPERATION", requirements },
    id,
  );

const analyze = (evidence) =>
  analyzeIntegration({ groups: { authentication: evidence } }).authentication;

const requirement = (schemeName) => [{
  alternative: 1,
  schemes: [{ schemeName, scopes: [] }],
}];

const cases = [
  {
    name: "No authentication evidence",
    evidence: [],
    expectedMethod: null,
    expectedAssessment: "UNKNOWN",
  },
  {
    name: "Authorization header alone",
    evidence: [
      createEvidence(
        "AUTHORIZATION_HEADER",
        "HTTP_AUTHORIZATION",
        { headerName: "Authorization", valueExpression: "<string>" },
        "auth-header",
      ),
    ],
    expectedMethod: null,
    expectedAssessment: "INFERRED",
  },
  {
    name: "API Key declaration",
    evidence: [
      createScheme("apiKeyAuth", {
        type: "apiKey",
        in: "header",
        parameterName: "X-API-Key",
      }, "api-key-scheme"),
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("apiKeyAuth"),
        "api-key-requirement",
      ),
    ],
    expectedMethod: "API Key (OpenAPI declaration; header: X-API-Key)",
  },
  {
    name: "HTTP Basic declaration",
    evidence: [
      createScheme("basicAuth", {
        type: "http",
        scheme: "basic",
      }, "basic-scheme"),
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("basicAuth"),
        "basic-requirement",
      ),
    ],
    expectedMethod: "HTTP Basic (OpenAPI declaration)",
  },
  {
    name: "HTTP Bearer declaration",
    evidence: [
      createScheme("bearerAuth", {
        type: "http",
        scheme: "bearer",
      }, "bearer-scheme"),
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("bearerAuth"),
        "bearer-requirement",
      ),
    ],
    expectedMethod: "HTTP Bearer (OpenAPI declaration)",
  },
  {
    name: "OAuth 2.0 declaration",
    evidence: [
      createScheme("oauthAuth", {
        type: "oauth2",
        flows: {
          clientCredentials: {
            tokenUrl: "https://example.com/oauth/token",
            scopes: {},
          },
        },
      }, "oauth-scheme"),
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("oauthAuth"),
        "oauth-requirement",
      ),
    ],
    expectedMethod: "OAuth 2.0 (OpenAPI declaration)",
  },
  {
    name: "OpenID Connect declaration",
    evidence: [
      createScheme("oidcAuth", {
        type: "openIdConnect",
        openIdConnectUrl: "https://example.com/.well-known/openid-configuration",
      }, "oidc-scheme"),
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("oidcAuth"),
        "oidc-requirement",
      ),
    ],
    expectedMethod: "OpenID Connect (OpenAPI declaration)",
  },
  {
    name: "Global security declaration",
    evidence: [
      createScheme("globalBearer", {
        type: "http",
        scheme: "bearer",
      }, "global-scheme"),
      createSecurity(
        "API_GLOBAL_SECURITY",
        requirement("globalBearer"),
        "global-requirement",
      ),
    ],
    expectedMethod: "HTTP Bearer (OpenAPI declaration)",
  },
  {
    name: "Incomplete security declaration",
    evidence: [
      createSecurity(
        "API_OPERATION_SECURITY",
        requirement("missingScheme"),
        "missing-requirement",
      ),
    ],
    expectedMethod: null,
  },
  {
    name: "Conflicting authentication declarations",
    evidence: [
      createScheme("bearerAuth", {
        type: "http",
        scheme: "bearer",
      }, "conflict-bearer"),
      createScheme("apiKeyAuth", {
        type: "apiKey",
        in: "header",
        parameterName: "X-API-Key",
      }, "conflict-api-key"),
      createSecurity(
        "API_OPERATION_SECURITY",
        [
          ...requirement("bearerAuth"),
          ...requirement("apiKeyAuth"),
        ],
        "conflict-requirement",
      ),
    ],
    expectedMethod: "Multiple declared authentication mechanisms",
  },
];

for (const testCase of cases) {
  const result = analyze(testCase.evidence);

  assert.equal(
    result.method,
    testCase.expectedMethod,
    `${testCase.name}: unexpected authentication method`,
  );

  assert.equal(
    result.finding.assessment,
    testCase.expectedAssessment ?? "INFERRED",
    `${testCase.name}: unexpected assessment`,
  );

  assert.equal(
    result.tokenEndpoint,
    null,
    `${testCase.name}: token endpoint must not be inferred`,
  );

  assert.equal(
    result.tokenAcquisition,
    null,
    `${testCase.name}: token acquisition must not be inferred`,
  );

  assert.equal(
    result.tokenRefresh,
    null,
    `${testCase.name}: token refresh must not be inferred`,
  );

  if (testCase.evidence.length > 0) {
    assert.ok(
      result.finding.evidenceIds.length > 0,
      `${testCase.name}: evidence IDs must be retained`,
    );
  }

  console.log(`PASS: ${testCase.name}`);
}

console.log(`\n${cases.length}/${cases.length} authentication tests passed.`);
