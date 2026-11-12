
import { groupEvidence } from "./evidenceGrouper.js";
import correlateEvidence from "./contextCorrelator.js";
import analyzeIntegration from "./integrationAnalyzer.js";
import buildIntegrationProfile from "./profileBuilder.js";
import verifyEvidence from "./evidenceVerifier.js";

import { buildAIContext } from "../ai/aiContextBuilder.js";
import { interpretEvidenceWithOpenRouter } from "../ai/aiProvider.js";

import config from "../../../config/config.js";

const DEFAULT_MODEL = "openai/gpt-oss-120b";

// --------------------------------------------------
// Input Validation
// --------------------------------------------------

const validateInput = ({
  integrationId,
  normalizedEvidence,
}) => {
  if (!integrationId || typeof integrationId !== "string") {
    throw new Error("A valid integrationId is required.");
  }

  if (!normalizedEvidence || typeof normalizedEvidence !== "object") {
    throw new Error("normalizedEvidence is required.");
  }

  if (!Array.isArray(normalizedEvidence.evidence)) {
    throw new Error(
      "normalizedEvidence.evidence must be an array.",
    );
  }

  if (!normalizedEvidence.schemaVersion) {
    throw new Error(
      "normalizedEvidence.schemaVersion is required.",
    );
  }
};

// --------------------------------------------------
// AI Result Helpers
// --------------------------------------------------

const createAIResult = ({
  status,
  provider = "OPENROUTER",
  model = config.OPENROUTER_MODEL || DEFAULT_MODEL,
  observations = [],
  error = null,
  requestId = null,
  usage = null,
}) => ({
  status,
  provider,
  model,
  observations,
  error,
  requestId,
  usage,
});

// --------------------------------------------------
// OpenRouter Interpretation
// --------------------------------------------------

const runAIInterpretation = async ({
  normalizedEvidence,
  analysis,
  metadata,
}) => {
  const enabled = String(config.AI_ENABLED).toLowerCase() === "true";

  if (!enabled) {
    return createAIResult({
      status: "DISABLED",
      provider: null,
      model: null,
    });
  }

  const selectedProvider = String(
    config.AI_PROVIDER || "",
  )
    .trim()
    .toLowerCase();

  if (selectedProvider !== "openrouter") {
    return createAIResult({
      status: "CONFIGURATION_ERROR",
      error: {
        code: "UNSUPPORTED_AI_PROVIDER",
        message:
          `Unsupported AI_PROVIDER: ${selectedProvider || "not configured"}. ` +
          "This application currently supports OpenRouter.",
      },
    });
  }

  try {
    // 1. Build bounded evidence-aware AI context.

    const context = buildAIContext({
      normalizedEvidence,
      analysis,
      metadata,
    });

    // 2. Execute OpenRouter request.

    const result = await interpretEvidenceWithOpenRouter({
      context,
      normalizedEvidence,
    });

    // 3. Return validated observations.

    return createAIResult({
      status: "AI_ENHANCED",
      provider: result.provider,
      model: result.model,
      observations: result.data.observations,
      requestId: result.requestId,
      usage: result.usage,
    });
  } catch (error) {
    // AI is supplementary.
    // A provider failure must not destroy deterministic analysis.

    console.error("[OpenRouter Interpretation Error]", {
      code: error.code ?? "AI_INTERPRETATION_FAILED",
      message: error.message,
      statusCode: error.statusCode ?? null,
    });

    return createAIResult({
      status: "DETERMINISTIC_FALLBACK",
      provider: "OPENROUTER",
      model: config.OPENROUTER_MODEL || DEFAULT_MODEL,
      observations: [],
      error: {
        code: error.code ?? "AI_INTERPRETATION_FAILED",
        message: error.message,
        statusCode: error.statusCode ?? null,
        details: error.details ?? null,
        invalidEvidenceIds: error.invalidEvidenceIds ?? [],
      },
    });
  }
};

// --------------------------------------------------
// Main Interpretation Pipeline
// --------------------------------------------------

const interpretIntegration = async ({
  integrationId,
  normalizedEvidence,
  metadata = {},
}) => {
  validateInput({
    integrationId,
    normalizedEvidence,
  });

  // 1. Group normalized evidence.

  const groupedResult = groupEvidence(normalizedEvidence);

  // 2. Correlate evidence.
  // Correlations are diagnostic, not proof.

  const correlationResult = correlateEvidence(groupedResult);

  // 3. Deterministic baseline analysis.

  const analysis = analyzeIntegration(groupedResult);

  // 4. Build deterministic Integration Profile.

  const baselineProfile = buildIntegrationProfile({
    analysis,
    normalizedEvidence,
    metadata,
  });

  // 5. Run supplementary AI interpretation.

  const aiResult = await runAIInterpretation({
    normalizedEvidence,
    analysis,
    metadata,
  });

  // 6. AI observations never overwrite deterministic findings.

  const profile = {
    ...baselineProfile,
    aiInsights: aiResult.observations,
  };

  // 7. Verify schema, provenance and evidence references.

  const verification = verifyEvidence({
    profile,
    normalizedEvidence,
  });

  // 8. Return complete interpretation result.

  return {
    success: verification.success,
    status: verification.status,

    integrationId,

    profile: verification.success ? profile : null,

    analysisSummary: analysis.summary,

    groupingSummary: groupedResult.summary,

    correlationSummary: correlationResult.summary,

    verification,

    limitations: baselineProfile.limitations,

    // Execution metadata for debugging and observability.
    ai: {
      status: aiResult.status,
      provider: aiResult.provider,
      model: aiResult.model,
      requestId: aiResult.requestId,
      usage: aiResult.usage,
      observationCount: aiResult.observations.length,
      error: aiResult.error,
    },
  };
};

export default interpretIntegration;
