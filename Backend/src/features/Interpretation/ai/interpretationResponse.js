
import { z } from "zod";

// --------------------------------------------------
// AI Response Schema
// --------------------------------------------------

export const AIInterpretationResponseSchema = z
  .object({
    observations: z
      .array(
        z
          .object({
            topic: z.string().min(1).max(100),

            observation: z.string().min(1).max(1200),

            interpretation: z.enum([
              "DIRECT_EVIDENCE",
              "INFERRED_RELATIONSHIP",
              "INSUFFICIENT_EVIDENCE",
            ]),

            confidence: z.enum([
              "HIGH",
              "MEDIUM",
              "LOW",
              "UNKNOWN",
            ]),

            evidenceIds: z
              .array(z.string().min(1))
              .max(30),

            caveats: z
              .array(z.string().max(500))
              .max(10)
              .default([]),
          })
          .strict(),
      )
      .max(40),
  })
  .strict();

// --------------------------------------------------
// Parse and Validate AI Response
// --------------------------------------------------

export const parseAIInterpretation = (
  rawContent,
  normalizedEvidence,
) => {
  if (typeof rawContent !== "string" || !rawContent.trim()) {
    const error = new Error(
      "OpenRouter returned an empty interpretation response.",
    );

    error.code = "AI_EMPTY_RESPONSE";
    throw error;
  }

  if (
    !normalizedEvidence ||
    !Array.isArray(normalizedEvidence.evidence)
  ) {
    throw new Error(
      "Valid normalized evidence is required to validate AI references.",
    );
  }

  // 1. Parse JSON.

  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch (cause) {
    const error = new Error(
      "OpenRouter returned invalid JSON.",
    );

    error.code = "AI_INVALID_JSON";
    error.cause = cause;

    throw error;
  }

  // 2. Validate response structure.

  const validated =
    AIInterpretationResponseSchema.safeParse(parsed);

  if (!validated.success) {
    const error = new Error(
      "OpenRouter response did not match the interpretation schema.",
    );

    error.code = "AI_SCHEMA_VALIDATION_FAILED";
    error.details = validated.error.flatten();

    throw error;
  }

  // 3. Build valid evidence ID index.

  const validEvidenceIds = new Set(
    normalizedEvidence.evidence
      .map((item) => item?.evidenceId)
      .filter((id) => typeof id === "string"),
  );

  // 4. Validate evidence references.

  const invalidEvidenceIds = [];

  for (const observation of validated.data.observations) {
    for (const evidenceId of observation.evidenceIds) {
      if (!validEvidenceIds.has(evidenceId)) {
        invalidEvidenceIds.push(evidenceId);
      }
    }
  }

  if (invalidEvidenceIds.length > 0) {
    const error = new Error(
      "OpenRouter response referenced evidence IDs that do not exist.",
    );

    error.code = "AI_INVALID_EVIDENCE_REFERENCE";

    error.invalidEvidenceIds = [
      ...new Set(invalidEvidenceIds),
    ];

    throw error;
  }

  // 5. Return validated data.

  return validated.data;
};

export default parseAIInterpretation;
