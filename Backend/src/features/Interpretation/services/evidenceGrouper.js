const EVIDENCE_GROUPS = Object.freeze([
  "PROVIDER_IDENTIFICATION",
  "AUTHENTICATION",
  "API_OPERATIONS",
  "PAYMENT_CAPABILITIES",
  "CONFIGURATION",
  "WEBHOOKS",
  "TRANSACTION_LIFECYCLE",
  "ERROR_HANDLING",
  "SECURITY",
  "DEPENDENCIES",
  "OTHER",
]);

const GROUP_RULES = {
  PROVIDER_IDENTIFICATION: [
    "PROVIDER",
    "BASE_URL_CONFIGURATION",
    "API_BASE_URL",
    "SDK_REFERENCE",
  ],

  AUTHENTICATION: [
    "AUTHORIZATION_HEADER",
    "AUTHENTICATION",
    "TOKEN_ENDPOINT",
    "TOKEN_REFERENCE",
    "OAUTH",
    "API_KEY",
  ],

  API_OPERATIONS: [
    "HTTP_REQUEST",
    "API_OPERATION",
    "API_ENDPOINT",
    "REQUEST_BODY",
    "RESPONSE_BODY",
    "HTTP_METHOD",
  ],

  PAYMENT_CAPABILITIES: [
    "PAYMENT_FUNCTION",
    "PAYOUT",
    "TRANSFER",
    "REFUND",
    "BENEFICIARY",
    "COLLECTION",
  ],

  CONFIGURATION: [
    "ENVIRONMENT_VARIABLE_REFERENCE",
    "ENVIRONMENT_VARIABLE_DECLARATION",
    "BASE_URL_CONFIGURATION",
    "HTTP_TIMEOUT_CONFIGURATION",
    "RETRY_CONFIGURATION",
    "IDEMPOTENCY_CONFIGURATION",
  ],

  WEBHOOKS: [
    "WEBHOOK",
    "WEBHOOK_ENDPOINT",
    "WEBHOOK_EVENT",
    "WEBHOOK_SIGNATURE",
  ],

  TRANSACTION_LIFECYCLE: [
    "TRANSACTION_STATUS",
    "PAYOUT_STATUS",
    "PAYMENT_STATUS",
    "STATUS_TRANSITION",
  ],

  ERROR_HANDLING: [
    "ERROR_HANDLING",
    "ERROR_RESPONSE",
    "RETRY_PATTERN",
    "EXCEPTION_HANDLING",
  ],

  SECURITY: [
    "AUTHORIZATION_HEADER",
    "SECRET_REFERENCE",
    "SECRET_EXPOSURE",
    "IDEMPOTENCY_KEY",
    "WEBHOOK_SIGNATURE",
    "SECURITY_CONFIGURATION",
  ],

  DEPENDENCIES: ["DEPENDENCY", "SDK_REFERENCE", "PACKAGE_REFERENCE"],
};

const normalizeEvidenceType = (evidenceType) => {
  if (typeof evidenceType !== "string") {
    return "";
  }

  return evidenceType.trim().toUpperCase();
};

const getEvidenceGroups = (evidenceType) => {
  const normalizedType = normalizeEvidenceType(evidenceType);

  const matchedGroups = Object.entries(GROUP_RULES)
    .filter(([, evidenceTypes]) => evidenceTypes.includes(normalizedType))
    .map(([group]) => group);

  return matchedGroups.length > 0 ? matchedGroups : ["OTHER"];
};

export const groupEvidence = (normalizedEvidence) => {
  if (!normalizedEvidence || !Array.isArray(normalizedEvidence.evidence)) {
    throw new TypeError(
      "Invalid normalized evidence: expected an evidence array.",
    );
  }

  const groups = Object.fromEntries(
    EVIDENCE_GROUPS.map((group) => [group, []]),
  );

  for (const evidence of normalizedEvidence.evidence) {
    if (!evidence || typeof evidence !== "object") {
      continue;
    }

    const matchedGroups = getEvidenceGroups(evidence.evidenceType);

    for (const group of matchedGroups) {
      groups[group].push(evidence);
    }
  }

  return {
    groups,

    summary: {
      totalEvidence: normalizedEvidence.evidence.length,

      groupedEvidence: Object.values(groups).reduce(
        (total, items) => total + items.length,
        0,
      ),

      groupCounts: Object.fromEntries(
        Object.entries(groups).map(([group, items]) => [group, items.length]),
      ),
    },
  };
};
