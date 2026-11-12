import { IntegrationProfileSchema } from "../validators/interpretation.schema.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const createUnknownFinding = (description, limitations = []) => ({
  description,
  assessment: "UNKNOWN",
  confidence: "UNKNOWN",
  evidenceIds: [],
  limitations,
});

const isSensitiveKey = (key = "") => {
  return /secret|password|token|api[_-]?key|private[_-]?key|credential|authorization|access[_-]?key|client[_-]?secret/i.test(
    String(key),
  );
};

// --------------------------------------------------
// Sensitive Value Redaction
// --------------------------------------------------

const redactSensitiveValue = (value) => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  let redacted = value;

  // Redact Bearer tokens.
  redacted = redacted.replace(
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    "Bearer [REDACTED]",
  );

  // Redact JWT-like values.
  redacted = redacted.replace(
    /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    "[REDACTED_JWT]",
  );

  // Redact credentials embedded in URLs.
  redacted = redacted.replace(
    /(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
    "$1[REDACTED]@",
  );

  // Redact common secret assignments.
  redacted = redacted.replace(
    /((?:client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*)["']?[^"'\s,;]+["']?/gi,
    "$1[REDACTED]",
  );

  return redacted;
};

const getEvidenceSource = (evidence) => ({
  file: evidence.source?.file ?? null,
  line: evidence.source?.line ?? null,
  column: evidence.source?.column ?? null,
  endLine: evidence.source?.endLine ?? null,
  endColumn: evidence.source?.endColumn ?? null,
  reference: evidence.source?.reference ?? null,
  format: evidence.source?.format ?? null,
});

// --------------------------------------------------
// Provider
// --------------------------------------------------

const buildProvider = (provider = {}) => ({
  name: provider.name && provider.name !== "UNKNOWN" ? provider.name : null,

  identificationStatus: provider.identificationStatus ?? "UNKNOWN",

  confidence: provider.confidence ?? "UNKNOWN",

  evidenceIds: provider.evidenceIds ?? [],

  alternatives: (provider.alternatives ?? [])
    .map((item) => (typeof item === "string" ? item : item?.name))
    .filter(Boolean),
});

// --------------------------------------------------
// Integration Details
// --------------------------------------------------

const buildIntegrationDetails = (analysis, metadata = {}) => ({
  name: metadata.name ?? null,

  description: metadata.description ?? null,

  type: analysis.integration?.type ?? "UNKNOWN",

  integrationMethod: metadata.integrationMethod ?? null,

  environment: metadata.environment ?? null,
});

// --------------------------------------------------
// Capabilities
// --------------------------------------------------

const buildCapabilities = (capabilities = []) => {
  return capabilities.map((item) => ({
    capability: item.name,

    description:
      item.finding?.description ??
      `Evidence related to ${item.name} was detected.`,

    assessment: item.finding?.assessment ?? "UNKNOWN",

    confidence: item.finding?.confidence ?? "UNKNOWN",

    evidenceIds: item.finding?.evidenceIds ?? [],

    limitations: item.finding?.limitations ?? [],
  }));
};

// --------------------------------------------------
// API Operations
// --------------------------------------------------

const buildApiOperations = (operations = []) => {
  return operations.map((item) => ({
    name: item.name ?? null,

    method: item.method ?? null,

    endpoint: item.endpoint ?? null,

    request: item.request ?? null,

    response: item.response ?? null,

    authentication: item.authentication ?? null,

    operationType: item.operationType ?? null,

    description: item.finding?.description ?? "An API operation was detected.",

    assessment: item.finding?.assessment ?? "UNKNOWN",

    confidence: item.finding?.confidence ?? "UNKNOWN",

    evidenceIds: item.finding?.evidenceIds ?? [],

    limitations: item.finding?.limitations ?? [],
  }));
};

// --------------------------------------------------
// Authentication
// --------------------------------------------------

const buildAuthentication = (authentication = {}) => {
  const finding = authentication.finding ?? {};

  return {
    method: authentication.method ?? null,

    tokenEndpoint: authentication.tokenEndpoint ?? null,

    tokenAcquisition: authentication.tokenAcquisition ?? null,

    tokenRefresh: authentication.tokenRefresh ?? null,

    description:
      finding.description ??
      "Authentication details could not be established from the available evidence.",

    assessment: finding.assessment ?? "UNKNOWN",

    confidence: finding.confidence ?? "UNKNOWN",

    evidenceIds: finding.evidenceIds ?? authentication.evidenceIds ?? [],

    limitations: finding.limitations ?? authentication.limitations ?? [],
  };
};

// --------------------------------------------------
// Architecture
// --------------------------------------------------

const buildArchitecture = (evidence = []) => {
  const files = new Map();

  for (const item of evidence) {
    const file = item.source?.file;

    if (!file) continue;

    if (!files.has(file)) {
      files.set(file, {
        name: file,

        responsibility: "Contains extracted integration-related evidence.",

        evidenceIds: [],
      });
    }

    files.get(file).evidenceIds.push(item.evidenceId);
  }

  const components = [...files.values()].map((component) => ({
    ...component,

    evidenceIds: unique(component.evidenceIds),
  }));

  const evidenceIds = unique(
    components.flatMap((component) => component.evidenceIds),
  );

  return {
    description:
      components.length > 0
        ? "Source files containing integration-related evidence were identified. These files provide partial insight into the integration structure."
        : "Architecture details could not be established from the available evidence.",

    // File presence is observed, but the complete application
    // architecture cannot be established through these files alone.
    assessment: components.length > 0 ? "INFERRED" : "UNKNOWN",

    confidence: components.length > 0 ? "LOW" : "UNKNOWN",

    evidenceIds,

    limitations: [
      "Identified source files do not establish the complete application architecture or runtime execution flow.",

      "The presence of integration-related evidence in a file does not establish its complete responsibility or relationship with other application components.",
    ],

    components,
  };
};

// --------------------------------------------------
// Transaction Lifecycle
// --------------------------------------------------

const buildTransactionLifecycle = (lifecycle = []) => {
  const states = lifecycle.map((item) => ({
    name: item.state,

    description:
      item.finding?.description ??
      `Evidence related to ${item.state} was detected.`,

    evidenceIds: item.finding?.evidenceIds ?? [],
  }));

  const evidenceIds = unique(
    lifecycle.flatMap((item) => item.finding?.evidenceIds ?? []),
  );

  const assessments = lifecycle.map((item) => item.finding?.assessment);

  const confidenceLevels = lifecycle.map((item) => item.finding?.confidence);

  // Preserve the strongest assessment actually assigned
  // by the deterministic analyzer.
  const assessment = assessments.includes("OBSERVED")
    ? "OBSERVED"
    : assessments.includes("INFERRED")
      ? "INFERRED"
      : "UNKNOWN";

  // Preserve the strongest confidence assigned by the analyzer.
  const confidence = confidenceLevels.includes("HIGH")
    ? "HIGH"
    : confidenceLevels.includes("MEDIUM")
      ? "MEDIUM"
      : confidenceLevels.includes("LOW")
        ? "LOW"
        : "UNKNOWN";

  return {
    description:
      states.length > 0
        ? "Transaction lifecycle-related evidence was detected."
        : "Transaction lifecycle could not be established from the available evidence.",

    assessment,

    confidence,

    evidenceIds,

    limitations: [
      "Detected lifecycle stages do not establish their execution order, successful transitions, or a complete transaction lifecycle.",

      "Static evidence does not establish that the detected transaction states occur during actual runtime execution.",
    ],

    states,
  };
};

// --------------------------------------------------
// Configuration
// --------------------------------------------------

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const getReferencedEnvironmentVariable = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      const references = value
        .map(getReferencedEnvironmentVariable)
        .filter(Boolean);

      return references[0] ?? null;
    }

    if (typeof value.expression === "string") {
      return getReferencedEnvironmentVariable(value.expression);
    }

    if (typeof value.accessExpression === "string") {
      return getReferencedEnvironmentVariable(value.accessExpression);
    }

    return null;
  }

  if (typeof value !== "string") return null;

  const patterns = [
    /\bprocess\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])/,
    /\bimport\.meta\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])/,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);

    if (match) return match[1] ?? match[2];
  }

  return null;
};

const getStrongestAssessment = (assessments = []) => {
  if (assessments.includes("OBSERVED")) return "OBSERVED";
  if (assessments.includes("INFERRED")) return "INFERRED";

  return "UNKNOWN";
};

const buildConfiguration = (configuration = []) => {
  const groups = new Map();

  configuration.forEach((item, index) => {
    const referencedEnvironmentVariable = getReferencedEnvironmentVariable(
      item.value,
    );

    const originalKey = item.name ?? item.evidenceType ?? "UNKNOWN";

    // Explicit environment-variable references provide
    // a reliable alias relationship.
    const key = referencedEnvironmentVariable ?? originalKey;

    // Avoid grouping unrelated records that have no
    // identifiable configuration name.
    const groupKey =
      originalKey === "UNKNOWN" && !referencedEnvironmentVariable
        ? `UNKNOWN_${item.evidenceId ?? index}`
        : key;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key,
        categories: [],
        values: [],
        evidenceIds: [],
        assessments: [],
        sensitive: false,
      });
    }

    const group = groups.get(groupKey);

    const category = item.evidenceType ?? "UNKNOWN";

    if (!group.categories.includes(category)) {
      group.categories.push(category);
    }

    if (
      item.value !== null &&
      item.value !== undefined &&
      !group.values.some(
        (existing) => JSON.stringify(existing) === JSON.stringify(item.value),
      )
    ) {
      group.values.push(item.value);
    }

    if (item.evidenceId) {
      group.evidenceIds.push(item.evidenceId);
    }

    group.assessments.push(item.assessment ?? "UNKNOWN");

    group.sensitive =
      group.sensitive || isSensitiveKey(item.name ?? "") || isSensitiveKey(key);
  });

  return [...groups.values()].map((group) => {
    const sensitive = group.sensitive;

    const values = group.values.map((value) =>
      sensitive ? null : redactSensitiveValue(value),
    );

    return {
      key: group.key,

      // Preserve a scalar when there is one distinct value.
      // Preserve all distinct values when evidence conflicts.
      value: sensitive
        ? null
        : values.length === 0
          ? null
          : values.length === 1
            ? values[0]
            : values,

      // Retain the original primary category for compatibility.
      category: group.categories[0] ?? "UNKNOWN",

      // Retain every category contributing to this configuration.
      categories: unique(group.categories),

      sensitive,

      assessment: getStrongestAssessment(group.assessments),

      evidenceIds: unique(group.evidenceIds),
    };
  });
};

// --------------------------------------------------
// Security Findings
// --------------------------------------------------

const buildSecurityFindings = (findings = []) => {
  return findings.map((item) => ({
    title: item.name ?? "Security-related evidence detected.",

    description:
      item.finding?.description ?? "Security-related evidence was detected.",

    assessment: item.finding?.assessment ?? "UNKNOWN",

    confidence: item.finding?.confidence ?? "UNKNOWN",

    evidenceIds: item.finding?.evidenceIds ?? [],

    limitations: item.finding?.limitations ?? [],

    // Detection alone is not sufficient to assign severity.
    severity: "UNKNOWN",
  }));
};

// --------------------------------------------------
// Dependencies
// --------------------------------------------------

const buildDependencies = () => {
  // Current ingestion evidence does not provide a dedicated,
  // structured dependency extraction category.
  //
  // Do not infer dependencies from arbitrary text or filenames.
  return [];
};

// --------------------------------------------------
// Evidence References
// --------------------------------------------------

const buildEvidenceReferences = (normalizedEvidence) => {
  return (normalizedEvidence?.evidence ?? []).map((item) => ({
    evidenceId: item.evidenceId,

    evidenceType: item.evidenceType,

    sourceCategory: item.sourceCategory,

    sourceExtractor: item.sourceExtractor,

    source: getEvidenceSource(item),
  }));
};

// --------------------------------------------------
// Profile Builder
// --------------------------------------------------

const buildIntegrationProfile = ({
  analysis,
  normalizedEvidence,
  metadata = {},
}) => {
  if (!analysis || !normalizedEvidence) {
    throw new Error(
      "Analysis and normalized evidence are required to build an integration profile.",
    );
  }

  if (!Array.isArray(normalizedEvidence.evidence)) {
    throw new Error("normalizedEvidence.evidence must be an array.");
  }

  const evidence = normalizedEvidence.evidence;

  // --------------------------------------------------
  // Profile Limitations
  // --------------------------------------------------

  const limitations = unique([
    ...(normalizedEvidence.limitations ?? []),

    "This profile is based on static evidence extraction and deterministic analysis.",

    "Detected declarations and code patterns do not establish successful runtime behavior.",

    "Missing evidence in the uploaded files does not prove that a capability is absent from the complete application.",

    "Evidence assessments describe the available evidence and do not establish production readiness.",

    ...(analysis.authentication?.limitations ?? []),

    ...(analysis.authentication?.finding?.limitations ?? []),

    ...(analysis.transactionLifecycle?.flatMap(
      (item) => item.finding?.limitations ?? [],
    ) ?? []),
  ]);

  // --------------------------------------------------
  // Build Profile
  // --------------------------------------------------

  const profile = {
    schemaVersion: "1.0.0",

    integration: buildIntegrationDetails(analysis, metadata),

    provider: buildProvider(analysis.provider),

    architecture: buildArchitecture(evidence),

    capabilities: buildCapabilities(analysis.capabilities),

    apiOperations: buildApiOperations(analysis.apiOperations),

    authentication: buildAuthentication(analysis.authentication),

    transactionLifecycle: buildTransactionLifecycle(
      analysis.transactionLifecycle,
    ),

    configuration: buildConfiguration(analysis.configuration),

    dependencies: buildDependencies(),

    securityFindings: buildSecurityFindings(analysis.securityFindings),

    evidenceReferences: buildEvidenceReferences(normalizedEvidence),

    limitations,
  };

  // --------------------------------------------------
  // Schema Validation
  // --------------------------------------------------

  // Validate the complete profile against the existing contract.
  return IntegrationProfileSchema.parse(profile);
};

export default buildIntegrationProfile;
