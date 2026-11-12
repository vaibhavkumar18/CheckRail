
import { z } from "zod";

const findingSchema = z
  .object({
    title: z.string().min(3).max(180),

    category: z.enum([
      "INTEGRATION",
      "PROVIDER_CAPABILITY",
      "PAYMENT_FLOW",
      "COUNTRY_REQUIREMENT",
      "REGULATORY",
      "BUSINESS_ELIGIBILITY",
      "OPERATIONAL",
      "SETTLEMENT",
      "SECURITY",
      "EVIDENCE_GAP",
    ]),

    severity: z.enum([
      "CRITICAL",
      "HIGH",
      "MEDIUM",
      "LOW",
      "INFORMATIONAL",
    ]),

    status: z.enum([
      "CONFIRMED_GAP",
      "POTENTIAL_GAP",
      "NO_GAP_IDENTIFIED",
      "INSUFFICIENT_EVIDENCE",
    ]),

    requirement: z.string().min(1).max(1500),
    observedState: z.string().min(1).max(1500),
    businessImpact: z.string().min(1).max(1200),
    recommendation: z.string().min(1).max(1500),
    rationale: z.string().min(1).max(1500),

    confidence: z.enum([
      "HIGH",
      "MEDIUM",
      "LOW",
      "UNKNOWN",
    ]),

    evidenceRefs: z
      .array(z.string().min(1).max(200))
      .max(30)
      .default([]),

    caveats: z
      .array(z.string().max(500))
      .max(10)
      .default([]),
  })
  .strict();

export const GapAnalysisResponseSchema = z
  .object({
    overallAssessment: z.enum([
      "READY",
      "READY_WITH_CONDITIONS",
      "NOT_READY",
      "INSUFFICIENT_EVIDENCE",
    ]),

    executiveSummary: z.string().min(1).max(3000),

    keyRisks: z
      .array(z.string().min(1).max(800))
      .max(12)
      .default([]),

    findings: z
      .array(findingSchema)
      .max(50),

    assumptions: z
      .array(z.string().max(800))
      .max(15)
      .default([]),

    limitations: z
      .array(z.string().max(800))
      .max(15)
      .default([]),
  })
  .strict();

/**
 * Parse and validate the AI response.
 *
 * Evidence references are strictly validated against
 * the references supplied by the context builder.
 */
export const parseGapAnalysisResponse = (
  rawContent,
  validEvidenceRefs = new Set(),
) => {
  if (
    typeof rawContent !== "string" ||
    !rawContent.trim()
  ) {
    const error = new Error(
      "OpenRouter returned an empty Gap Analysis response.",
    );

    error.code = "AI_EMPTY_RESPONSE";
    throw error;
  }

  let parsed;

  try {
    const cleaned = rawContent
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    parsed = JSON.parse(cleaned);
  } catch (cause) {
    const error = new Error(
      "OpenRouter returned invalid JSON for Gap Analysis.",
    );

    error.code = "AI_INVALID_JSON";
    error.cause = cause;
    throw error;
  }

  const validated =
    GapAnalysisResponseSchema.safeParse(parsed);

  if (!validated.success) {
    const error = new Error(
      "OpenRouter response did not match the Gap Analysis schema.",
    );

    error.code = "AI_SCHEMA_VALIDATION_FAILED";
    error.details = validated.error.flatten();

    throw error;
  }

  const allowedRefs =
    validEvidenceRefs instanceof Set
      ? validEvidenceRefs
      : new Set(validEvidenceRefs || []);

  const invalidRefs = [];

  for (const finding of validated.data.findings) {
    for (const ref of finding.evidenceRefs) {
      if (!allowedRefs.has(ref)) {
        invalidRefs.push(ref);
      }
    }
  }

  if (invalidRefs.length > 0) {
    const error = new Error(
      "AI response referenced evidence that is not present in the supplied assessment context.",
    );

    error.code = "AI_INVALID_EVIDENCE_REFERENCE";

    error.invalidEvidenceRefs = [
      ...new Set(invalidRefs),
    ];

    throw error;
  }

  return {
    ...validated.data,

    findings: validated.data.findings.map(
      (finding, index) => ({
        id: `finding-${index + 1}`,
        ...finding,
      }),
    ),
  };
};
