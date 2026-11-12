import { IntegrationProfileSchema } from "../validators/interpretation.schema.js";

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const VALID_ASSESSMENTS = new Set(["OBSERVED", "INFERRED", "UNKNOWN"]);

const VALID_CONFIDENCE = new Set(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

const unique = (items) => [...new Set(items)];

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

// --------------------------------------------------
// Evidence Index
// --------------------------------------------------

const createEvidenceIndex = (normalizedEvidence) => {
  const evidence = normalizedEvidence?.evidence;

  if (!Array.isArray(evidence)) {
    throw new Error("normalizedEvidence.evidence must be an array.");
  }

  const evidenceMap = new Map();
  const duplicateIds = [];

  for (const item of evidence) {
    if (!isNonEmptyString(item?.evidenceId)) {
      continue;
    }

    if (evidenceMap.has(item.evidenceId)) {
      duplicateIds.push(item.evidenceId);
      continue;
    }

    evidenceMap.set(item.evidenceId, item);
  }

  return {
    evidenceMap,
    duplicateIds: unique(duplicateIds),
  };
};

// --------------------------------------------------
// Finding Collection
// --------------------------------------------------

const collectFindings = (profile) => {
  const findings = [];

  const addFinding = (finding, location) => {
    if (!finding || typeof finding !== "object") return;

    findings.push({
      location,
      assessment: finding.assessment,
      confidence: finding.confidence,
      evidenceIds: finding.evidenceIds,
    });
  };

  // Actual Finding objects only.
  addFinding(profile.architecture, "architecture");

  addFinding(profile.authentication, "authentication");

  addFinding(profile.transactionLifecycle, "transactionLifecycle");

  profile.capabilities.forEach((item, index) => {
    addFinding(item, `capabilities[${index}]`);
  });

  profile.apiOperations.forEach((item, index) => {
    addFinding(item, `apiOperations[${index}]`);
  });

  profile.securityFindings.forEach((item, index) => {
    addFinding(item, `securityFindings[${index}]`);
  });

  return findings;
};

// --------------------------------------------------
// Additional Evidence ID Collections
// --------------------------------------------------

const collectEvidenceIdGroups = (profile) => {
  const groups = [];

  const addGroup = (location, evidenceIds) => {
    groups.push({
      location,
      evidenceIds,
    });
  };

  // Provider has confidence and identificationStatus,
  // but it is not a generic Finding.
  addGroup("provider", profile.provider.evidenceIds);

  // Configuration has assessment but no confidence.
  profile.configuration.forEach((item, index) => {
    addGroup(`configuration[${index}]`, item.evidenceIds);
  });

  // Architecture components.
  profile.architecture.components.forEach((item, index) => {
    addGroup(
      `architecture.components[${index}]`,
      item.evidenceIds,
    );
  });

  // Transaction lifecycle states.
  profile.transactionLifecycle.states.forEach((item, index) => {
    addGroup(
      `transactionLifecycle.states[${index}]`,
      item.evidenceIds,
    );
  });

  // Dependencies.
  profile.dependencies.forEach((item, index) => {
    addGroup(`dependencies[${index}]`, item.evidenceIds);
  });

  // Supplementary AI observations must also reference existing evidence.
  (profile.aiInsights ?? []).forEach((item, index) => {
    addGroup(`aiInsights[${index}]`, item.evidenceIds);
  });

  return groups;
};

// --------------------------------------------------
// Evidence Reference Verification
// --------------------------------------------------

const verifyEvidenceReferences = (profile, evidenceMap) => {
  const errors = [];
  const warnings = [];

  const referencedIds = new Set();

  for (const reference of profile.evidenceReferences) {
    const evidenceId = reference.evidenceId;

    if (referencedIds.has(evidenceId)) {
      warnings.push({
        code: "DUPLICATE_PROFILE_EVIDENCE_REFERENCE",
        evidenceId,
      });
    }

    referencedIds.add(evidenceId);

    const original = evidenceMap.get(evidenceId);

    if (!original) {
      errors.push({
        code: "EVIDENCE_REFERENCE_NOT_FOUND",
        evidenceId,
      });

      continue;
    }

    if (reference.evidenceType !== original.evidenceType) {
      errors.push({
        code: "EVIDENCE_TYPE_MISMATCH",
        evidenceId,
      });
    }

    if (reference.sourceCategory !== original.sourceCategory) {
      errors.push({
        code: "SOURCE_CATEGORY_MISMATCH",
        evidenceId,
      });
    }

    if (reference.sourceExtractor !== original.sourceExtractor) {
      errors.push({
        code: "SOURCE_EXTRACTOR_MISMATCH",
        evidenceId,
      });
    }

    if (reference.source?.file !== (original.source?.file ?? null)) {
      errors.push({
        code: "SOURCE_FILE_MISMATCH",
        evidenceId,
      });
    }

    if (!isNonEmptyString(reference.evidenceType)) {
      errors.push({
        code: "INVALID_EVIDENCE_TYPE",
        evidenceId,
      });
    }

    if (!isNonEmptyString(reference.sourceExtractor)) {
      errors.push({
        code: "INVALID_SOURCE_EXTRACTOR",
        evidenceId,
      });
    }
  }

  // Check whether original evidence was omitted from the profile.
  for (const evidenceId of evidenceMap.keys()) {
    if (!referencedIds.has(evidenceId)) {
      warnings.push({
        code: "EVIDENCE_NOT_INCLUDED_IN_PROFILE",
        evidenceId,
      });
    }
  }

  return {
    errors,
    warnings,
    totalReferences: profile.evidenceReferences.length,
    uniqueReferences: referencedIds.size,
  };
};

// --------------------------------------------------
// Finding Verification
// --------------------------------------------------

const verifyFindings = (findings, evidenceMap) => {
  const errors = [];
  const warnings = [];

  for (const finding of findings) {
    const { location, assessment, confidence, evidenceIds } = finding;

    if (!VALID_ASSESSMENTS.has(assessment)) {
      errors.push({
        code: "INVALID_ASSESSMENT",
        location,
        assessment,
      });
    }

    if (!VALID_CONFIDENCE.has(confidence)) {
      errors.push({
        code: "INVALID_CONFIDENCE",
        location,
        confidence,
      });
    }

    if (!Array.isArray(evidenceIds)) {
      errors.push({
        code: "INVALID_EVIDENCE_IDS",
        location,
      });

      continue;
    }

    if (
      ["OBSERVED", "INFERRED"].includes(assessment) &&
      evidenceIds.length === 0
    ) {
      errors.push({
        code: "FINDING_WITHOUT_EVIDENCE",
        location,
        assessment,
      });
    }

    if (assessment === "UNKNOWN" && evidenceIds.length > 0) {
      warnings.push({
        code: "UNKNOWN_FINDING_HAS_EVIDENCE",
        location,
      });
    }

    for (const evidenceId of evidenceIds) {
      if (!evidenceMap.has(evidenceId)) {
        errors.push({
          code: "FINDING_REFERENCES_UNKNOWN_EVIDENCE",
          location,
          evidenceId,
        });
      }
    }
  }

  return {
    errors,
    warnings,
    totalFindings: findings.length,
  };
};

// --------------------------------------------------
// Additional Evidence ID Verification
// --------------------------------------------------

const verifyEvidenceIdGroups = (groups, evidenceMap) => {
  const errors = [];

  for (const group of groups) {
    const { location, evidenceIds } = group;

    if (!Array.isArray(evidenceIds)) {
      errors.push({
        code: "INVALID_EVIDENCE_IDS",
        location,
      });

      continue;
    }

    for (const evidenceId of evidenceIds) {
      if (!evidenceMap.has(evidenceId)) {
        errors.push({
          code: "FINDING_REFERENCES_UNKNOWN_EVIDENCE",
          location,
          evidenceId,
        });
      }
    }
  }

  return {
    errors,
    totalGroups: groups.length,
  };
};

// --------------------------------------------------
// Duplicate Evidence Verification
// --------------------------------------------------

const verifyDuplicateEvidence = (duplicateIds) => {
  return duplicateIds.map((evidenceId) => ({
    code: "DUPLICATE_NORMALIZED_EVIDENCE_ID",
    evidenceId,
  }));
};

// --------------------------------------------------
// Main Verifier
// --------------------------------------------------

const verifyEvidence = ({ profile, normalizedEvidence }) => {
  if (!profile || !normalizedEvidence) {
    throw new Error("Profile and normalized evidence are required.");
  }

  // Validate profile structure first.
  const schemaResult = IntegrationProfileSchema.safeParse(profile);

  if (!schemaResult.success) {
    return {
      success: false,
      status: "INVALID_PROFILE",

      errors: schemaResult.error.issues.map((issue) => ({
        code: "PROFILE_SCHEMA_VALIDATION_FAILED",
        path: issue.path.join("."),
        message: issue.message,
      })),

      warnings: [],

      summary: {
        totalEvidence: 0,
        totalFindings: 0,
        totalReferences: 0,
      },
    };
  }

  const { evidenceMap, duplicateIds } =
    createEvidenceIndex(normalizedEvidence);

  // Verify provenance references.
  const referenceResult = verifyEvidenceReferences(
    profile,
    evidenceMap,
  );

  // Verify actual Finding objects.
  const findings = collectFindings(profile);

  const findingResult = verifyFindings(
    findings,
    evidenceMap,
  );

  // Verify evidence IDs in non-Finding profile structures.
  const evidenceIdGroups = collectEvidenceIdGroups(profile);

  const evidenceIdResult = verifyEvidenceIdGroups(
    evidenceIdGroups,
    evidenceMap,
  );

  // Verify duplicate normalized evidence IDs.
  const duplicateErrors = verifyDuplicateEvidence(duplicateIds);

  const errors = [
    ...referenceResult.errors,
    ...findingResult.errors,
    ...evidenceIdResult.errors,
    ...duplicateErrors,
  ];

  const warnings = [
    ...referenceResult.warnings,
    ...findingResult.warnings,
  ];

  const success = errors.length === 0;

  return {
    success,

    status: success
      ? warnings.length > 0
        ? "PASSED_WITH_WARNINGS"
        : "PASSED"
      : "FAILED",

    errors,

    warnings,

    summary: {
      totalEvidence: evidenceMap.size,

      totalFindings: findingResult.totalFindings,

      totalEvidenceIdGroups: evidenceIdResult.totalGroups,

      totalReferences: referenceResult.totalReferences,

      uniqueReferences: referenceResult.uniqueReferences,

      errorCount: errors.length,

      warningCount: warnings.length,
    },
  };
};

export default verifyEvidence;