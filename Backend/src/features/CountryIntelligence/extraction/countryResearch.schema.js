
import { z } from "zod";

/**
 * Canonical Country Intelligence response schema.
 *
 * This schema is used for:
 * 1. Runtime validation using safeParse().
 * 2. Generating the JSON Schema for OpenRouter Structured Outputs.
 */

export const CountryResearchResponseSchema = z
  .object({
    country: z
      .object({
        code: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .describe("ISO 3166-1 alpha-2 country code."),

        name: z
          .string()
          .min(1)
          .max(120)
          .describe("Country name."),
      })
      .strict(),

    overview: z
      .object({
        summary: z
          .string()
          .min(20)
          .max(1800)
          .describe(
            "Evidence-based country payment ecosystem summary. Must be a single string."
          ),

        officialCurrency: z
          .array(z.string().min(1).max(80))
          .max(8),

        currencyAndSettlementNotes: z
          .array(z.string().min(1).max(500))
          .max(8),

        paymentMethods: z
          .array(z.string().min(1).max(160))
          .max(15),

        collectionNotes: z
          .array(z.string().min(1).max(500))
          .max(8),

        disbursementNotes: z
          .array(z.string().min(1).max(500))
          .max(8),

        researchLimitations: z
          .array(z.string().min(1).max(500))
          .max(12),
      })
      .strict(),

    requirements: z
      .array(
        z
          .object({
            category: z.enum([
              "PAYMENT_ECOSYSTEM",
              "COLLECTIONS",
              "DISBURSEMENTS",
              "CURRENCY_AND_SETTLEMENT",
              "BUSINESS_ELIGIBILITY",
              "REGULATORY",
              "KYC_AML",
              "BANKING_AND_OPERATIONS",
            ]),

            title: z
              .string()
              .min(4)
              .max(240),

            description: z
              .string()
              .min(20)
              .max(1800),

            applicability: z.enum([
              "MARKETPLACE",
              "MERCHANT",
              "CUSTOMER",
              "PAYMENT_PROVIDER",
              "GENERAL",
            ]),

            evidenceStatus: z.enum([
              "CONFIRMED",
              "UNVERIFIED",
              "CONFLICTING",
            ]),

            confidence: z.enum([
              "HIGH",
              "MEDIUM",
              "LOW",
              "UNKNOWN",
            ]),

            confidenceScore: z
              .number()
              .min(0)
              .max(1)
              .nullable(),

            evidenceIds: z
              .array(
                z.string().regex(/^SRC_\d+$/)
              )
              .min(1)
              .max(8),

            limitations: z
              .array(z.string().max(500))
              .max(8),
          })
          .strict()
      )
      .max(60),
  })
  .strict();

/**
 * Generate JSON Schema from the Zod schema.
 * Requires Zod 4.
 */
const generatedJsonSchema = z.toJSONSchema(
  CountryResearchResponseSchema
);

const {
  $schema,
  ...openRouterJsonSchema
} = generatedJsonSchema;

export const CountryResearchStructuredOutputSchema =
  openRouterJsonSchema;

/**
 * Normalize only the known summary-array variation.
 * All other fields remain subject to strict validation.
 */
const normalizeKnownShapeVariation = (value) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !value.overview ||
    typeof value.overview !== "object" ||
    !Array.isArray(value.overview.summary)
  ) {
    return value;
  }

  return {
    ...value,

    overview: {
      ...value.overview,

      summary: value.overview.summary
        .filter((part) => typeof part === "string")
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" "),
    },
  };
};

/**
 * Parse and validate AI response.
 */
export const parseCountryResearchResponse = (
  rawContent,
  sources,
  expectedCountry
) => {
  let parsed;

  try {
    parsed = JSON.parse(rawContent);
  } catch (cause) {
    const error = new Error(
      "Country research AI returned invalid JSON."
    );

    error.code = "COUNTRY_AI_INVALID_JSON";
    error.cause = cause;

    throw error;
  }

  const normalized =
    normalizeKnownShapeVariation(parsed);

  const validated =
    CountryResearchResponseSchema.safeParse(normalized);

  if (!validated.success) {
    const error = new Error(
      "Country research AI response failed Zod schema validation."
    );

    error.code = "COUNTRY_AI_SCHEMA_INVALID";

    error.details = validated.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    }));

    throw error;
  }

  // Verify that the model returned the requested country.
  if (
    expectedCountry &&
    (
      validated.data.country.code !== expectedCountry.countryCode ||
      validated.data.country.name !== expectedCountry.countryName
    )
  ) {
    const error = new Error(
      "Country research AI returned a country that does not match the requested target country."
    );

    error.code = "COUNTRY_AI_COUNTRY_MISMATCH";
    error.expectedCountry = expectedCountry;
    error.actualCountry = validated.data.country;

    throw error;
  }

  // Validate evidence references against retrieved sources.
  const validSourceIds = new Set(
    sources.map((source) => source.sourceKey)
  );

  const invalidSourceIds = [];

  for (const requirement of validated.data.requirements) {
    for (const sourceId of requirement.evidenceIds) {
      if (!validSourceIds.has(sourceId)) {
        invalidSourceIds.push(sourceId);
      }
    }
  }

  if (invalidSourceIds.length > 0) {
    const error = new Error(
      "Country research AI referenced source IDs that were not retrieved."
    );

    error.code = "COUNTRY_AI_INVALID_SOURCE_REFERENCE";

    error.invalidSourceIds = [
      ...new Set(invalidSourceIds),
    ];

    throw error;
  }

  return validated.data;
};
