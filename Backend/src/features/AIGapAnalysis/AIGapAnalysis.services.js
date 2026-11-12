import config from "../../config/config.js";
import {
  getProjectAndCapabilityContext,
  getCapabilityChecks,
  getCapabilityEvidence,
  getCompletedCountryProfile,
  getCountryRequirementsWithSources,
  getCountryProfileSources,
  createGapAnalysisRun,
  completeGapAnalysisRun,
  failGapAnalysisRun,
  getGapAnalysisRunForUser,
} from "./AIGapAnalysis.model.js";
import { generateGapAnalysisWithOpenRouter } from "./ai/gapAnalysis.provider.js";

const MAX_CONTEXT_CHARS = 120000;
const MAX_TEXT_LENGTH = 2500;
const MAX_COUNTRY_SOURCE_EXCERPT_CHARS = 1800;

const SENSITIVE_KEY =
  /(secret|password|token|authorization|api[_-]?key|client[_-]?secret|private[_-]?key|credential_payload|encrypted)/i;

const redactString = (value) => {
  if (typeof value !== "string") return value;

  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED_JWT]",
    )
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1[REDACTED]@")
    .slice(0, MAX_TEXT_LENGTH);
};

const sanitize = (value, key = "", depth = 0) => {
  if (SENSITIVE_KEY.test(key)) {
    return "[REDACTED]";
  }

  if (depth > 7) {
    return "[MAX_DEPTH]";
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitize(item, "", depth + 1));
  }

  if (value && typeof value === "object") {
    const result = {};

    for (const [childKey, childValue] of Object.entries(value).slice(0, 100)) {
      result[childKey] = sanitize(childValue, childKey, depth + 1);
    }

    return result;
  }

  return null;
};

const parseJsonValue = (value, fallback = null) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeCountries = (value) => {
  const parsed = parseJsonValue(value, []);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return [
    ...new Set(
      parsed
        .filter((country) => typeof country === "string")
        .map((country) => country.trim().toUpperCase())
        .filter((country) => /^[A-Z]{2}$/.test(country)),
    ),
  ];
};

const makeEvidenceRef = (kind, id) => `${kind}:${id}`;

const tokenize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

/**
 * Select relevant passages from a source excerpt.
 *
 * Each source is included only once in the context.
 * The selected passages are based on the requirements
 * that reference that source.
 *
 * Source metadata and evidence references are preserved
 * separately from the excerpt.
 */
const selectRelevantPassages = (
  excerpt,
  requirementTexts,
  maxChars = MAX_COUNTRY_SOURCE_EXCERPT_CHARS,
) => {
  if (typeof excerpt !== "string" || !excerpt.trim()) {
    return "";
  }

  const normalizedExcerpt = excerpt.replace(/\s+/g, " ").trim();

  const sentences = normalizedExcerpt
    .split(/(?<=[.!?])\s+(?=[A-Z0-9(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return normalizedExcerpt.slice(0, maxChars);
  }

  const keywords = new Set(requirementTexts.flatMap((text) => tokenize(text)));

  const scoredSentences = sentences.map((sentence, index) => {
    const words = tokenize(sentence);
    const uniqueWords = new Set(words);

    let score = 0;

    for (const word of uniqueWords) {
      if (keywords.has(word)) {
        score += 1;
      }
    }

    // Prefer substantive sentences over navigation and boilerplate.
    if (words.length >= 12) {
      score += 1;
    }

    return {
      sentence,
      index,
      score,
    };
  });

  const selected = [];
  let usedCharacters = 0;

  const rankedSentences = [...scoredSentences].sort(
    (a, b) => b.score - a.score || a.index - b.index,
  );

  for (const item of rankedSentences) {
    const addition = item.sentence.length + (selected.length ? 1 : 0);

    if (usedCharacters + addition > maxChars) {
      continue;
    }

    selected.push(item);
    usedCharacters += addition;

    if (usedCharacters >= maxChars * 0.85) {
      break;
    }
  }

  if (!selected.length) {
    return normalizedExcerpt.slice(0, maxChars);
  }

  // Restore the original document order.
  return selected
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ");
};

/**
 * Build the AI context.
 *
 * Important:
 * - No duplicate evidenceCatalog.
 * - Capability checks appear only in capabilityVerification.checks.
 * - Runtime evidence appears only in capabilityVerification.evidence.
 * - Country sources appear once in countryIntelligence.sources.
 * - Country requirements reference their sources by evidenceRef.
 */
const buildEvidenceContext = ({
  project,
  checks,
  capabilityEvidence,
  countryProfile,
  countryRequirements,
  countrySources,
}) => {
  const validEvidenceRefs = new Set();

  const registerRef = (kind, id) => {
    const ref = makeEvidenceRef(kind, id);
    validEvidenceRefs.add(ref);
    return ref;
  };

  const integrationSourceRef = registerRef(
    "integration_source",
    project.source_id,
  );

  const integrationProfileRef = registerRef(
    "integration_profile",
    project.integration_id,
  );

  /**
   * Capability checks
   */
  const safeChecks = checks.map((check) => ({
    evidenceRef: registerRef("capability_check", check.id),

    ...sanitize({
      operation: check.operation,
      status: check.status,
      message: check.message,
      providerStatus: check.provider_status,
      resourceId: check.resource_id,
      executionOrder: check.execution_order,
      attemptCount: check.attempt_count,
      errorCode: check.error_code,
      errorMessage: check.error_message,
      startedAt: check.started_at,
      completedAt: check.completed_at,
    }),
  }));

  /**
   * Capability runtime evidence
   */
  const safeCapabilityEvidence = capabilityEvidence.map((item) => ({
    evidenceRef: registerRef("capability_evidence", item.id),

    ...sanitize({
      evidenceType: item.evidence_type,
      operation: item.operation,
      httpMethod: item.http_method,
      endpoint: item.endpoint,
      httpStatus: item.http_status,
      resourceId: item.resource_id,
      metadata: item.metadata,
      observedAt: item.observed_at,
    }),
  }));

  /**
   * Country Intelligence
   */
  let country = null;
  let uniqueCountrySourceCount = 0;

  if (countryProfile) {
    /**
     * Create a unique source map.
     *
     * The initial countrySources query provides source metadata
     * and excerpts. Requirements provide source relationships.
     */
    const sourceById = new Map(
      countrySources.map((source) => [
        source.id,
        {
          ...source,
          requirementTexts: [],
        },
      ]),
    );

    const requirementSourceIds = new Map();

    /**
     * Associate each source with the requirements that reference it.
     */
    for (const requirement of countryRequirements) {
      const sources = parseJsonValue(requirement.sources, []);

      const requirementText = [
        requirement.category || "",
        requirement.title || "",
        requirement.description || "",
      ].join(" ");

      const linkedIds = [];

      for (const source of Array.isArray(sources) ? sources : []) {
        if (!source?.id) {
          continue;
        }

        linkedIds.push(source.id);

        const existing = sourceById.get(source.id) || {
          ...source,

          source_name: source.sourceName || source.source_name,

          source_url: source.url || source.source_url,

          source_domain: source.domain || source.source_domain,

          published_at: source.publishedAt || source.published_at,

          retrieved_at: source.retrievedAt || source.retrieved_at,

          requirementTexts: [],
        };

        existing.requirementTexts.push(requirementText);

        sourceById.set(source.id, existing);
      }

      requirementSourceIds.set(requirement.id, [...new Set(linkedIds)]);
    }

    /**
     * Serialize every country source exactly once.
     */
    const safeCountrySources = [...sourceById.values()].map((source) => ({
      evidenceRef: registerRef("country_source", source.id),

      sourceId: source.id,

      sourceName: source.sourceName || source.source_name || null,

      url: source.url || source.source_url || null,

      domain: source.domain || source.source_domain || null,

      publishedAt: source.publishedAt || source.published_at || null,

      retrievedAt: source.retrievedAt || source.retrieved_at || null,

      excerpt: selectRelevantPassages(source.excerpt, source.requirementTexts),
    }));

    const sourceRefById = new Map(
      safeCountrySources.map((source) => [source.sourceId, source.evidenceRef]),
    );

    /**
     * Country requirements retain their source relationships.
     * They do not contain duplicate source excerpts.
     */
    const safeRequirements = countryRequirements.map((requirement) => ({
      evidenceRef: registerRef("country_requirement", requirement.id),

      ...sanitize({
        category: requirement.category,
        title: requirement.title,
        description: requirement.description,
        applicability: requirement.applicability,
        evidenceStatus: requirement.evidence_status,
        confidence: requirement.confidence,
        confidenceScore: requirement.confidence_score,
        limitations: requirement.limitations,
      }),

      sources: (requirementSourceIds.get(requirement.id) || []).map(
        (sourceId) => ({
          evidenceRef: sourceRefById.get(sourceId) || null,
        }),
      ),
    }));

    uniqueCountrySourceCount = safeCountrySources.length;

    country = {
      intelligenceId: countryProfile.intelligence_id,
      countryRunId: countryProfile.country_run_id,
      countryCode: countryProfile.country_code,
      countryName: countryProfile.country_name,
      status: countryProfile.status,
      researchedAt: countryProfile.researched_at,

      overview: sanitize(countryProfile.overview),

      requirements: safeRequirements,

      sources: safeCountrySources,
    };
  }

  /**
   * Final evidence context.
   *
   * There is intentionally no evidenceCatalog property.
   */
  const context = {
    schemaVersion: "corridorgate-gap-analysis-v1",

    project: {
      projectId: project.project_id,
      projectName: project.project_name,
      provider: project.project_provider,
      integrationType: project.integration_type,
      assessmentObjective: project.assessment_objective,
      sourceCountry: project.source_country,

      targetCountries: normalizeCountries(project.target_countries),
    },

    integration: {
      integrationId: project.integration_id,
      sourceId: project.source_id,
      sourceFilename: project.source_filename,
      sourceType: project.source_type,
      sourceStatus: project.source_status,
      reviewStatus: project.integration_review_status,

      sourceEvidenceRef: integrationSourceRef,
      profileEvidenceRef: integrationProfileRef,

      profile: sanitize(parseJsonValue(project.integration_profile, {})),
    },

    capabilityVerification: {
      capabilityId: project.capability_run_id,
      provider: project.capability_provider,
      environment: project.environment,
      capabilityCode: project.capability_code,
      overallStatus: project.overall_status,
      executionStatus: project.execution_status,
      startedAt: project.capability_started_at,
      completedAt: project.capability_completed_at,
      credentialId: project.credential_id,
      credentialVersion: project.credential_version,

      checks: safeChecks,

      evidence: safeCapabilityEvidence,
    },

    countryIntelligence: country,

    evidenceSummary: {
      totalCapabilityChecks: checks.length,
      totalCapabilityEvidence: capabilityEvidence.length,
      totalCountryRequirements: countryRequirements.length,
      totalCountrySources: uniqueCountrySourceCount,
      countryIntelligenceIncluded: Boolean(countryProfile),
    },
  };

  const serializedContext = JSON.stringify(context);
  const serializedLength = serializedContext.length;

  console.log("AI Gap Analysis context diagnostics:", {
    totalCharacters: serializedLength,

    sections: {
      project: JSON.stringify(context.project).length,
      integration: JSON.stringify(context.integration).length,
      capabilityVerification: JSON.stringify(context.capabilityVerification)
        .length,
      countryIntelligence: JSON.stringify(context.countryIntelligence).length,
      evidenceSummary: JSON.stringify(context.evidenceSummary).length,
    },

    capabilityChecks: context.capabilityVerification.checks.length,

    capabilityEvidence: context.capabilityVerification.evidence.length,

    countryRequirements: context.countryIntelligence?.requirements?.length || 0,

    countrySources: context.countryIntelligence?.sources?.length || 0,
  });

  if (serializedLength > MAX_CONTEXT_CHARS) {
    const error = new Error(
      `The deduplicated evidence context is still too large (${serializedLength} characters; limit ${MAX_CONTEXT_CHARS}). Review oversized Integration Profile or capability metadata.`,
    );

    error.code = "AI_CONTEXT_TOO_LARGE";
    error.statusCode = 413;

    throw error;
  }

  return {
    context,
    validEvidenceRefs,
  };
};

const createServiceError = (message, code, statusCode = 409) => {
  const error = new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
};

/**
 * Map the database run to the public API response.
 */
const toReportResponse = (run) => ({
  id: run.id,
  status: run.status,
  projectId: run.project_id,
  integrationId: run.integration_id,
  capabilityId: run.capability_run_id,

  countryProfileIds: parseJsonValue(run.country_profile_ids, []),

  provider: run.provider,
  environment: run.environment,
  model: run.model,
  aiRequestId: run.ai_request_id,
  aiUsage: run.ai_usage,
  report: run.report,

  error:
    run.status === "FAILED"
      ? {
          code: run.error_code,
          message: run.error_message,
        }
      : null,

  createdAt: run.created_at,
  startedAt: run.started_at,
  completedAt: run.completed_at,
});

/**
 * Execute AI Gap Analysis for a project.
 *
 * capabilityId must be the ID of the completed
 * Capability Verification run, not the credential
 * verification run ID.
 */
export const runProjectGapAnalysis = async ({
  projectId,
  capabilityId,
  userId,
}) => {
  const project = await getProjectAndCapabilityContext({
    projectId,
    capabilityId,
    userId,
  });

  if (!project) {
    throw createServiceError(
      "Project or Capability Verification run was not found, or you do not have access.",
      "GAP_ANALYSIS_CONTEXT_NOT_FOUND",
      404,
    );
  }

  if (project.project_provider !== project.capability_provider) {
    throw createServiceError(
      "The project provider does not match the provider recorded on the Capability Verification run.",
      "PROJECT_PROVIDER_MISMATCH",
      409,
    );
  }

  if (!["PAYPAL", "HYPERWALLET"].includes(project.project_provider)) {
    throw createServiceError(
      "This provider is not supported for Gap Analysis.",
      "UNSUPPORTED_PROVIDER",
      400,
    );
  }

  if (project.execution_status !== "COMPLETED") {
    throw createServiceError(
      "AI Gap Analysis is available after Capability Verification execution has completed.",
      "CAPABILITY_VERIFICATION_NOT_COMPLETED",
      409,
    );
  }

  const integrationProfile = parseJsonValue(project.integration_profile, null);

  if (
    !integrationProfile ||
    typeof integrationProfile !== "object" ||
    Array.isArray(integrationProfile)
  ) {
    throw createServiceError(
      "The selected integration does not contain a usable Integration Profile.",
      "INTEGRATION_PROFILE_UNAVAILABLE",
      409,
    );
  }

  /**
   * Load the selected Capability Verification evidence.
   */
  const checks = await getCapabilityChecks(project.capability_run_id);

  const capabilityEvidence = await getCapabilityEvidence(
    project.capability_run_id,
  );

  if (!checks.length) {
    throw createServiceError(
      "The completed Capability Verification run has no operation checks to analyze.",
      "CAPABILITY_CHECKS_UNAVAILABLE",
      409,
    );
  }

  let countryProfile = null;
  let countryRequirements = [];
  let countrySources = [];

  const countryProfileIds = [];

  /**
   * Hyperwallet expansion assessments require
   * completed Country Intelligence for the same
   * project and target country.
   *
   * PayPal does not require Country Intelligence here.
   */
  if (project.project_provider === "HYPERWALLET") {
    const targetCountries = normalizeCountries(project.target_countries);

    if (targetCountries.length !== 1) {
      throw createServiceError(
        "Hyperwallet Capability Verification currently requires exactly one target country. Gap Analysis needs that same project country context.",
        "HYPERWALLET_SINGLE_TARGET_COUNTRY_REQUIRED",
        409,
      );
    }

    countryProfile = await getCompletedCountryProfile({
      projectId,
      countryCode: targetCountries[0],
    });

    if (!countryProfile) {
      throw createServiceError(
        `Completed Country Intelligence is required for ${targetCountries[0]} before Hyperwallet expansion Gap Analysis can run.`,
        "COUNTRY_INTELLIGENCE_NOT_COMPLETED",
        409,
      );
    }

    countryProfileIds.push(countryProfile.intelligence_id);

    countryRequirements = await getCountryRequirementsWithSources(
      countryProfile.intelligence_id,
    );

    countrySources = await getCountryProfileSources(
      countryProfile.intelligence_id,
    );
  }

  /**
   * Build compact, deduplicated context.
   */
  const { context, validEvidenceRefs } = buildEvidenceContext({
    project,
    checks,
    capabilityEvidence,
    countryProfile,
    countryRequirements,
    countrySources,
  });

  /**
   * Create the run only after context validation.
   */
  const analysisRun = await createGapAnalysisRun({
    projectId,
    integrationId: project.integration_id,
    capabilityId: project.capability_run_id,
    countryProfileIds,
    provider: project.project_provider,
    environment: project.environment,
    userId,
  });

  try {
    const aiResult = await generateGapAnalysisWithOpenRouter({
      context,
      validEvidenceRefs,
    });

    /**
     * Deterministic metrics are calculated from
     * database evidence, not generated by the AI.
     */
    const deterministicMetrics = {
      totalChecks: checks.length,

      passedChecks: checks.filter((item) => item.status === "PASSED").length,

      failedChecks: checks.filter((item) => item.status === "FAILED").length,

      blockedChecks: checks.filter((item) => item.status === "BLOCKED").length,

      unknownChecks: checks.filter((item) => item.status === "UNKNOWN").length,

      unsupportedChecks: checks.filter((item) => item.status === "UNSUPPORTED")
        .length,

      capabilityOverallStatus: project.overall_status,

      capabilityExecutionStatus: project.execution_status,
    };

    /**
     * Build the final report.
     */
    const report = {
      schemaVersion: "corridorgate-gap-analysis-report-v1",

      generatedAt: new Date().toISOString(),

      project: {
        id: project.project_id,
        name: project.project_name,
        provider: project.project_provider,
        assessmentObjective: project.assessment_objective,
        integrationType: project.integration_type,
      },

      integration: {
        integrationId: project.integration_id,
        sourceId: project.source_id,
        sourceFilename: project.source_filename,
        reviewStatus: project.integration_review_status,
      },

      capabilityVerification: {
        runId: project.capability_run_id,
        capabilityCode: project.capability_code,
        environment: project.environment,
        overallStatus: project.overall_status,
        executionStatus: project.execution_status,
        credentialVersion: project.credential_version,
        metrics: deterministicMetrics,
      },

      countryIntelligence: countryProfile
        ? {
            intelligenceId: countryProfile.intelligence_id,

            countryCode: countryProfile.country_code,

            countryName: countryProfile.country_name,

            researchedAt: countryProfile.researched_at,

            requirementCount: countryRequirements.length,

            sourceCount: Number(
              countryProfile.source_count ?? countrySources.length,
            ),
          }
        : null,

      ai: {
        provider: aiResult.provider,
        model: aiResult.model,
        requestId: aiResult.requestId,
        usage: aiResult.usage,
      },

      assessment: aiResult.data,

      evidenceSummary: context.evidenceSummary,

      disclaimer:
        "This is an evidence-based decision-support assessment, not legal advice, regulatory approval, provider certification, or a guarantee of production readiness. Sandbox results are limited to the tested operations and environment.",
    };

    /**
     * Persist the completed report and evidence snapshot.
     */
    const completed = await completeGapAnalysisRun({
      runId: analysisRun.id,
      model: aiResult.model,
      requestId: aiResult.requestId,
      usage: aiResult.usage,
      evidenceSnapshot: context,
      report,
    });

    if (!completed) {
      throw new Error(
        "The AI Gap Analysis report was generated but could not be persisted.",
      );
    }

    return toReportResponse(completed);
  } catch (error) {
    /**
     * Persist failed execution status.
     */
    await failGapAnalysisRun({
      runId: analysisRun.id,
      code: error.code || "AI_GAP_ANALYSIS_FAILED",
      message: error.message,
    }).catch((persistError) => {
      console.error(
        "Failed to persist Gap Analysis failure:",
        persistError.message,
      );
    });

    throw error;
  }
};

/**
 * Retrieve a previously generated Gap Analysis run.
 */
export const getProjectGapAnalysisRun = async ({
  projectId,
  runId,
  userId,
}) => {
  const run = await getGapAnalysisRunForUser({
    projectId,
    runId,
    userId,
  });

  if (!run) {
    throw createServiceError(
      "Gap Analysis run not found or access denied.",
      "GAP_ANALYSIS_RUN_NOT_FOUND",
      404,
    );
  }

  return toReportResponse(run);
};
