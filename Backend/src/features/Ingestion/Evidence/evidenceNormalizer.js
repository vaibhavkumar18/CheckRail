import { createHash as createNodeHash } from "node:crypto";

const NORMALIZER_VERSION = "1.0.0";
const MAX_EVIDENCE_ITEMS = 40_000;

const EXTRACTOR_NAMES = {
  openApi: "OPENAPI_EXTRACTOR",
  code: "CODE_EXTRACTOR",
  config: "CONFIG_EXTRACTOR",
  documentation: "DOCUMENTATION_EXTRACTOR",
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const stableStringify = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();

    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify(value[key])}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
};

const sha256 = (value) =>
  createNodeHash("sha256")
    .update(value)
    .digest("hex");

const normalizeConfidence = (confidence) => {
  const normalized = String(confidence ?? "UNKNOWN").toUpperCase();

  if (["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(normalized)) {
    return normalized;
  }

  return "UNKNOWN";
};

const normalizeInterpretation = (interpretation) => {
  const normalized = String(
    interpretation ?? "UNSPECIFIED",
  ).toUpperCase();

  if (
    [
      "DIRECT_OBSERVATION",
      "DOCUMENTATION_STATEMENT",
      "INFERRED",
      "UNKNOWN",
      "UNSPECIFIED",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return "UNSPECIFIED";
};

const normalizeLimitations = (limitations) => {
  if (!Array.isArray(limitations)) {
    return [];
  }

  return [
    ...new Set(
      limitations.filter(
        (item) => typeof item === "string" && item.trim(),
      ),
    ),
  ];
};

// --------------------------------------------------
// Source normalization
// --------------------------------------------------

const normalizeSource = ({
  file,
  line = null,
  column = null,
  endLine = null,
  endColumn = null,
  reference = null,
  format = null,
}) => ({
  file: typeof file === "string" ? file : null,
  line: Number.isInteger(line) ? line : null,
  column: Number.isInteger(column) ? column : null,
  endLine: Number.isInteger(endLine) ? endLine : null,
  endColumn: Number.isInteger(endColumn) ? endColumn : null,
  reference: typeof reference === "string" ? reference : null,
  format: typeof format === "string" ? format : null,
});

// --------------------------------------------------
// Evidence identity
// --------------------------------------------------

const createEvidenceId = (item) => {
  const identity = {
    evidenceType: item.evidenceType,
    source: item.source,
    subject: item.subject,
    value: item.value,
    interpretation: item.interpretation,
  };

  return `ev_${sha256(stableStringify(identity))}`;
};

// --------------------------------------------------
// Common evidence record
// --------------------------------------------------

const createNormalizedEvidence = ({
  evidenceType,
  sourceCategory,
  sourceExtractor,
  subject = null,
  value = null,
  source,
  confidence = "UNKNOWN",
  interpretation = "UNSPECIFIED",
  limitations = [],
  metadata = {},
}) => {
  const normalized = {
    evidenceType,
    sourceCategory,
    sourceExtractor,

    subject:
      typeof subject === "string" ? subject : null,

    value,

    interpretation:
      normalizeInterpretation(interpretation),

    confidence:
      normalizeConfidence(confidence),

    source,

    limitations:
      normalizeLimitations(limitations),

    metadata,
  };

  return {
    evidenceId: createEvidenceId(normalized),
    ...normalized,
  };
};

// --------------------------------------------------
// Common extractor validation
// --------------------------------------------------

const validateExtractorResult = (
  result,
  extractorName,
) => {
  if (result === undefined || result === null) {
    return null;
  }

  if (!isPlainObject(result)) {
    throw new Error(
      `${extractorName} result must be an object.`,
    );
  }

  return result;
};

// --------------------------------------------------
// Standard evidence[] normalization
// Used by code, config and documentation extractors.
// --------------------------------------------------

const normalizeEvidenceArray = ({
  result,
  extractorName,
  sourceCategory,
}) => {
  if (!result) {
    return [];
  }

  if (!Array.isArray(result.evidence)) {
    throw new Error(
      `${extractorName} result must contain an evidence array.`,
    );
  }

  return result.evidence.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new Error(
        `${extractorName} evidence[${index}] must be an object.`,
      );
    }

    if (
      typeof item.evidenceType !== "string" ||
      !item.evidenceType.trim()
    ) {
      throw new Error(
        `${extractorName} evidence[${index}] has no valid evidenceType.`,
      );
    }

    const source = normalizeSource({
      file: item.source?.file,
      line: item.source?.line,
      column: item.source?.column,
      endLine: item.source?.endLine,
      endColumn: item.source?.endColumn,
    });

    return createNormalizedEvidence({
      evidenceType: item.evidenceType,
      sourceCategory,
      sourceExtractor: extractorName,
      subject: item.subject ?? null,
      value: item.value ?? null,
      source,
      confidence: item.confidence,
      interpretation: item.interpretation,
      limitations: item.limitations,
      metadata: {},
    });
  });
};

// --------------------------------------------------
// OpenAPI normalization
// --------------------------------------------------

const OPENAPI_LIMITATIONS = [
  "This evidence originates from an API specification declaration.",
  "A declared API contract does not prove that the endpoint is implemented.",
  "Runtime behavior and provider compliance are not established.",
];

const normalizeOpenApiEvidence = (result) => {
  if (!result) {
    return [];
  }

  if (result.evidenceType !== "API_SPECIFICATION") {
    throw new Error(
      "OpenAPI result must have evidenceType API_SPECIFICATION.",
    );
  }

  if (!isPlainObject(result.source)) {
    throw new Error(
      "OpenAPI result must contain a source object.",
    );
  }

  const file = result.source.file;

  if (typeof file !== "string" || !file.trim()) {
    throw new Error(
      "OpenAPI result must contain source.file.",
    );
  }

  const evidence = [];

  const add = ({
    evidenceType,
    subject,
    value,
    reference,
    limitations = [],
  }) => {
    evidence.push(
      createNormalizedEvidence({
        evidenceType,
        sourceCategory: "API_SPECIFICATION",
        sourceExtractor: EXTRACTOR_NAMES.openApi,
        subject,
        value,
        source: normalizeSource({
          file,
          reference,
          format: result.source.format,
        }),
        confidence: "HIGH",
        interpretation: "DIRECT_OBSERVATION",
        limitations: [
          ...OPENAPI_LIMITATIONS,
          ...limitations,
        ],
        metadata: {
          specificationVersion:
            result.specificationVersion ?? null,
        },
      }),
    );
  };

  // Specification metadata.
  if (isPlainObject(result.specification)) {
    add({
      evidenceType: "API_SPECIFICATION_METADATA",
      subject: result.specification.title ?? null,
      value: result.specification,
      reference: "$.info",
    });
  }

  // API servers.
  if (!Array.isArray(result.servers)) {
    throw new Error(
      "OpenAPI servers must be an array.",
    );
  }

  for (const server of result.servers) {
    add({
      evidenceType: "API_SERVER",
      subject: server.url ?? null,
      value: server,
      reference: server.sourceReference ?? null,
    });
  }

  // Security schemes.
  if (!Array.isArray(result.securitySchemes)) {
    throw new Error(
      "OpenAPI securitySchemes must be an array.",
    );
  }

  for (const scheme of result.securitySchemes) {
    add({
      evidenceType: "API_SECURITY_SCHEME",
      subject: scheme.name ?? null,
      value: scheme,
      reference: scheme.sourceReference ?? null,
      limitations: [
        "A declared security scheme does not prove correct authentication implementation.",
      ],
    });
  }

  // Global security requirements.
  if (!Array.isArray(result.globalSecurity)) {
    throw new Error(
      "OpenAPI globalSecurity must be an array.",
    );
  }

  result.globalSecurity.forEach((requirement, index) => {
    add({
      evidenceType: "API_GLOBAL_SECURITY",
      subject: `Global security requirement ${index + 1}`,
      value: requirement,
      reference: "$.security",
      limitations: [
        "A security requirement in the API contract does not prove runtime enforcement.",
      ],
    });
  });

  // Operations.
  if (!Array.isArray(result.operations)) {
    throw new Error(
      "OpenAPI operations must be an array.",
    );
  }

  for (const operation of result.operations) {
    const operationReference =
      operation.sourceReference ?? null;

    const operationSubject =
      `${operation.method ?? "UNKNOWN"} ${operation.path ?? "UNKNOWN"}`;

    add({
      evidenceType: "API_OPERATION",
      subject: operationSubject,
      value: {
        path: operation.path ?? null,
        method: operation.method ?? null,
        operationId: operation.operationId ?? null,
        summary: operation.summary ?? null,
        description: operation.description ?? null,
        tags: operation.tags ?? [],
        deprecated: Boolean(operation.deprecated),
        security: operation.security ?? null,
      },
      reference: operationReference,
      limitations: [
        "An API operation declaration does not prove that source code implements the operation.",
      ],
    });

    // Parameters.
    if (!Array.isArray(operation.parameters)) {
      throw new Error(
        `Parameters for ${operationSubject} must be an array.`,
      );
    }

    for (const parameter of operation.parameters) {
      add({
        evidenceType: "API_OPERATION_PARAMETER",
        subject: parameter.name ?? null,
        value: parameter,
        reference: parameter.sourceReference ?? operationReference,
      });
    }

    // Request body.
    if (operation.requestBody) {
      add({
        evidenceType: "API_REQUEST_BODY",
        subject: operationSubject,
        value: operation.requestBody,
        reference:
          operation.requestBody.sourceReference ??
          operationReference,
      });
    }

    // Responses.
    if (!Array.isArray(operation.responses)) {
      throw new Error(
        `Responses for ${operationSubject} must be an array.`,
      );
    }

    for (const response of operation.responses) {
      add({
        evidenceType: "API_RESPONSE",
        subject: `${operationSubject} -> ${response.statusCode ?? "UNKNOWN"}`,
        value: response,
        reference: response.sourceReference ?? operationReference,
      });
    }

    // Operation-level security, including explicit security: [].
    if (
      operation.security?.source === "OPERATION"
    ) {
      add({
        evidenceType: "API_OPERATION_SECURITY",
        subject: operationSubject,
        value: operation.security,
        reference: operationReference
          ? `${operationReference}.security`
          : null,
        limitations: [
          "Declared operation security does not prove runtime authorization enforcement.",
        ],
      });
    }
  }

  return evidence;
};

// --------------------------------------------------
// Error normalization
// --------------------------------------------------

const normalizeExtractorErrors = ({
  result,
  sourceExtractor,
  sourceCategory,
}) => {
  if (!result || !Array.isArray(result.errors)) {
    return [];
  }

  return result.errors.map((error) => ({
    sourceExtractor,
    sourceCategory,
    file: error.file ?? null,
    type: error.type ?? "UNKNOWN_ERROR",
    message: error.message ?? "Unknown extraction error.",
    line: Number.isInteger(error.line) ? error.line : null,
    column: Number.isInteger(error.column) ? error.column : null,
  }));
};

// --------------------------------------------------
// Extractor metadata
// --------------------------------------------------

const createExtractorMetadata = (result, sourceExtractor) => {
  if (!result) {
    return {
      provided: false,
      extractor: sourceExtractor,
      summary: null,
      limitations: [],
    };
  }

  return {
    provided: true,
    extractor: result.extractor?.name ?? sourceExtractor,
    version: result.extractor?.version ?? null,
    parser: result.extractor?.parser ?? null,
    summary: result.summary ?? null,
    limitations: normalizeLimitations(result.limitations),
  };
};

// --------------------------------------------------
// Main normalizer
// --------------------------------------------------

export const normalizeEvidence = ({
  openApi = null,
  code = null,
  config = null,
  documentation = null,
} = {}) => {
  const results = {
    openApi: validateExtractorResult(
      openApi,
      EXTRACTOR_NAMES.openApi,
    ),

    code: validateExtractorResult(
      code,
      EXTRACTOR_NAMES.code,
    ),

    config: validateExtractorResult(
      config,
      EXTRACTOR_NAMES.config,
    ),

    documentation: validateExtractorResult(
      documentation,
      EXTRACTOR_NAMES.documentation,
    ),
  };

  const evidence = [];

  evidence.push(
    ...normalizeOpenApiEvidence(results.openApi),
  );

  evidence.push(
    ...normalizeEvidenceArray({
      result: results.code,
      extractorName: EXTRACTOR_NAMES.code,
      sourceCategory: "SOURCE_CODE",
    }),
  );

  evidence.push(
    ...normalizeEvidenceArray({
      result: results.config,
      extractorName: EXTRACTOR_NAMES.config,
      sourceCategory: "CONFIGURATION",
    }),
  );

  evidence.push(
    ...normalizeEvidenceArray({
      result: results.documentation,
      extractorName: EXTRACTOR_NAMES.documentation,
      sourceCategory: "DOCUMENTATION",
    }),
  );

  if (evidence.length > MAX_EVIDENCE_ITEMS) {
    throw new Error(
      `Normalized evidence exceeds the ${MAX_EVIDENCE_ITEMS} item limit.`,
    );
  }

  // Deduplicate only exact normalized evidence identities.
  const uniqueEvidence = [];
  const seenEvidence = new Set();

  for (const item of evidence) {
    const identity = stableStringify({
      evidenceType: item.evidenceType,
      sourceCategory: item.sourceCategory,
      sourceExtractor: item.sourceExtractor,
      subject: item.subject,
      value: item.value,
      interpretation: item.interpretation,
      source: item.source,
    });

    if (seenEvidence.has(identity)) {
      continue;
    }

    seenEvidence.add(identity);
    uniqueEvidence.push(item);
  }

  const evidenceByType = {};
  const evidenceByCategory = {};
  const evidenceByExtractor = {};

  for (const item of uniqueEvidence) {
    evidenceByType[item.evidenceType] =
      (evidenceByType[item.evidenceType] ?? 0) + 1;

    evidenceByCategory[item.sourceCategory] =
      (evidenceByCategory[item.sourceCategory] ?? 0) + 1;

    evidenceByExtractor[item.sourceExtractor] =
      (evidenceByExtractor[item.sourceExtractor] ?? 0) + 1;
  }

  const errors = [
    ...normalizeExtractorErrors({
      result: results.code,
      sourceExtractor: EXTRACTOR_NAMES.code,
      sourceCategory: "SOURCE_CODE",
    }),

    ...normalizeExtractorErrors({
      result: results.config,
      sourceExtractor: EXTRACTOR_NAMES.config,
      sourceCategory: "CONFIGURATION",
    }),

    ...normalizeExtractorErrors({
      result: results.documentation,
      sourceExtractor: EXTRACTOR_NAMES.documentation,
      sourceCategory: "DOCUMENTATION",
    }),
  ];

  return {
    schemaVersion: NORMALIZER_VERSION,

    evidence: uniqueEvidence,

    summary: {
      inputEvidenceCount: evidence.length,
      normalizedEvidenceCount: uniqueEvidence.length,
      duplicateEvidenceRemoved:
        evidence.length - uniqueEvidence.length,

      evidenceByType,
      evidenceByCategory,
      evidenceByExtractor,

      errorCount: errors.length,
    },

    extractors: {
      openApi: createExtractorMetadata(
        results.openApi,
        EXTRACTOR_NAMES.openApi,
      ),

      code: createExtractorMetadata(
        results.code,
        EXTRACTOR_NAMES.code,
      ),

      config: createExtractorMetadata(
        results.config,
        EXTRACTOR_NAMES.config,
      ),

      documentation: createExtractorMetadata(
        results.documentation,
        EXTRACTOR_NAMES.documentation,
      ),
    },

    errors,

    limitations: [
      "Normalization standardizes extracted evidence; it does not independently verify the underlying claims.",
      "OpenAPI declarations remain API contract evidence, not implementation proof.",
      "Documentation statements remain documentation evidence, not implementation proof.",
      "Confidence values are preserved from the source extractors; they are not recalculated.",
      "Evidence IDs are deterministic for identical normalized evidence and source provenance.",
      "Exact duplicate evidence is removed; semantically similar evidence is retained.",
      "No evidence is upgraded from inferred or unknown to directly observed.",
    ],
  };
};