const MAX_EVIDENCE_ITEMS = 250;
const MAX_STRING_LENGTH = 1200;
const MAX_CONTEXT_CHARS = 90_000;

const SENSITIVE_KEY =
  /(secret|password|token|authorization|api[_-]?key|client[_-]?secret|credential|private[_-]?key)/i;

const redactString = (input) => {
  if (typeof input !== "string") return input;

  return input
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]")
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[REDACTED]@")
    .replace(
      /((?:client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*)["']?[^"'\s,;]+["']?/gi,
      "$1[REDACTED]",
    )
    .slice(0, MAX_STRING_LENGTH);
};

const sanitizeValue = (value, key = "", depth = 0) => {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (depth > 5) return "[MAX_DEPTH]";
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeValue(item, "", depth + 1));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 40)) {
      result[childKey] = sanitizeValue(childValue, childKey, depth + 1);
    }
    return result;
  }
  return null;
};

const buildEvidenceItem = (item) => ({
  evidenceId: item.evidenceId,
  evidenceType: item.evidenceType ?? "UNKNOWN",
  sourceCategory: item.sourceCategory ?? "UNKNOWN",
  sourceExtractor: item.sourceExtractor ?? "UNKNOWN",
  subject: redactString(item.subject ?? ""),
  value: sanitizeValue(item.value ?? null, "value"),
  source: {
    file: redactString(item.source?.file ?? ""),
    line: item.source?.line ?? null,
    endLine: item.source?.endLine ?? null,
    format: item.source?.format ?? null,
  },
});

export const buildAIContext = ({ normalizedEvidence, analysis, metadata = {} }) => {
  const evidence = normalizedEvidence?.evidence;

  if (!Array.isArray(evidence)) {
    throw new Error("Cannot build AI context without normalized evidence.");
  }

  const safeEvidence = evidence
    .filter((item) => item && typeof item.evidenceId === "string")
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map(buildEvidenceItem);

  const context = {
    schemaVersion: normalizedEvidence.schemaVersion,
    integrationMetadata: {
      name: redactString(metadata.name ?? ""),
      description: redactString(metadata.description ?? ""),
    },
    deterministicSummary: sanitizeValue(analysis?.summary ?? {}),
    evidence: safeEvidence,
    contextLimits: {
      evidenceIncluded: safeEvidence.length,
      evidenceAvailable: evidence.length,
      truncated: evidence.length > safeEvidence.length,
    },
  };

  let serialized = JSON.stringify(context);
  if (serialized.length > MAX_CONTEXT_CHARS) {
    // Keep the evidence IDs and provenance, but reduce verbose values.
    context.evidence = safeEvidence.map((item) => ({
      ...item,
      value: "[OMITTED: CONTEXT SIZE LIMIT]",
      subject: item.subject.slice(0, 250),
    }));
    serialized = JSON.stringify(context);
  }

  if (serialized.length > MAX_CONTEXT_CHARS) {
    throw new Error("Sanitized AI context exceeds the configured size limit.");
  }

  return context;
};
