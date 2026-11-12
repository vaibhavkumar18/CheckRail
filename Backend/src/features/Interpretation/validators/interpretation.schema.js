import { z } from "zod";

// --------------------------------------------------
// Enums
// --------------------------------------------------

const AssessmentStatusSchema = z.enum(["OBSERVED", "INFERRED", "UNKNOWN"]);

const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

const IntegrationTypeSchema = z.enum([
  "COLLECTION",
  "DISBURSEMENT",
  "BOTH",
  "UNKNOWN",
]);

const IdentificationStatusSchema = z.enum([
  "IDENTIFIED",
  "POSSIBLE",
  "UNKNOWN",
]);

// --------------------------------------------------
// Evidence Reference
// --------------------------------------------------

const EvidenceReferenceSchema = z.object({
  evidenceId: z.string().min(1),

  evidenceType: z.string().min(1),

  sourceCategory: z.string().min(1),

  sourceExtractor: z.string().min(1),

  source: z.object({
    file: z.string().nullable(),
    line: z.number().int().nullable(),
    column: z.number().int().nullable(),
    endLine: z.number().int().nullable(),
    endColumn: z.number().int().nullable(),
    reference: z.string().nullable(),
    format: z.string().nullable(),
  }),
});

// --------------------------------------------------
// Common Finding
// --------------------------------------------------

const FindingSchema = z.object({
  description: z.string(),

  assessment: AssessmentStatusSchema,

  confidence: ConfidenceSchema,

  evidenceIds: z.array(z.string()),

  limitations: z.array(z.string()).default([]),
});

// --------------------------------------------------
// Integration Details
// --------------------------------------------------

const IntegrationDetailsSchema = z.object({
  name: z.string().nullable(),

  description: z.string().nullable(),

  type: IntegrationTypeSchema,

  integrationMethod: z.string().nullable(),

  environment: z.string().nullable(),
});

// --------------------------------------------------
// Provider
// --------------------------------------------------

const ProviderSchema = z.object({
  name: z.string().nullable(),

  identificationStatus: IdentificationStatusSchema,

  confidence: ConfidenceSchema,

  evidenceIds: z.array(z.string()),

  alternatives: z.array(z.string()).default([]),
});

// --------------------------------------------------
// Capabilities
// --------------------------------------------------

const CapabilitySchema = FindingSchema.extend({
  capability: z.string().min(1),
});

// --------------------------------------------------
// API Operations
// --------------------------------------------------

const ApiOperationSchema = FindingSchema.extend({
  name: z.string().nullable(),

  method: z.string().nullable(),

  endpoint: z.string().nullable(),

  request: z.unknown().nullable(),

  response: z.unknown().nullable(),

  authentication: z
    .object({
      detected: z.boolean().optional(),
      declared: z.boolean().optional(),
      mechanism: z.string().nullable().optional(),
      requirements: z.array(z.unknown()).optional(),
      evidenceIds: z.array(z.string()).default([]),
    })
    .nullable()
    .default(null),

  operationType: z.string().nullable(),
});

// --------------------------------------------------
// Authentication
// --------------------------------------------------

const AuthenticationSchema = FindingSchema.extend({
  method: z.string().nullable(),

  tokenEndpoint: z.string().nullable(),

  tokenAcquisition: z.string().nullable(),

  tokenRefresh: z.string().nullable(),
});

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const ConfigurationSchema = z.object({
  key: z.string(),

  value: z.unknown().nullable(),

  category: z.string(),
  categories: z.array(z.string()).default([]),

  sensitive: z.boolean(),

  assessment: AssessmentStatusSchema,

  evidenceIds: z.array(z.string()),
});

// --------------------------------------------------
// Dependencies
// --------------------------------------------------

const DependencySchema = z.object({
  name: z.string(),

  version: z.string().nullable(),

  purpose: z.string().nullable(),

  assessment: AssessmentStatusSchema,

  evidenceIds: z.array(z.string()),
});

// --------------------------------------------------
// Security Findings
// --------------------------------------------------

const SecurityFindingSchema = FindingSchema.extend({
  title: z.string(),

  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", "UNKNOWN"]),
});


const AIInsightSchema = z.object({
  topic: z.string().min(1).max(100),
  observation: z.string().min(1).max(1200),
  interpretation: z.enum([
    "DIRECT_EVIDENCE",
    "INFERRED_RELATIONSHIP",
    "INSUFFICIENT_EVIDENCE",
  ]),
  confidence: ConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)).max(30),
  caveats: z.array(z.string().max(500)).default([]),
});

// --------------------------------------------------
// Integration Profile
// --------------------------------------------------

export const IntegrationProfileSchema = z.object({
  schemaVersion: z.literal("1.0.0"),

  integration: IntegrationDetailsSchema,

  provider: ProviderSchema,

  architecture: FindingSchema.extend({
    components: z.array(
      z.object({
        name: z.string(),

        responsibility: z.string(),

        evidenceIds: z.array(z.string()),
      }),
    ),
  }),

  capabilities: z.array(CapabilitySchema),

  apiOperations: z.array(ApiOperationSchema),

  authentication: AuthenticationSchema,

  transactionLifecycle: FindingSchema.extend({
    states: z.array(
      z.object({
        name: z.string(),

        description: z.string(),

        evidenceIds: z.array(z.string()),
      }),
    ),
  }),

  configuration: z.array(ConfigurationSchema),

  dependencies: z.array(DependencySchema),

  securityFindings: z.array(SecurityFindingSchema),

  evidenceReferences: z.array(EvidenceReferenceSchema),

  limitations: z.array(z.string()),

  // Supplementary AI observations; never used as deterministic readiness findings.
  aiInsights: z.array(AIInsightSchema).default([]),
});
