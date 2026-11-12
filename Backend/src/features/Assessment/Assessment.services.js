
import {
    IntegrationProfileSchema,
} from "../Interpretation/validators/interpretation.schema.js";

import {
    getIntegrationForUser,
} from "../Integration/Integration.model.js";

import {
    createAssessmentRun,
    getAssessmentByIntegration,
} from "./Assessment.model.js";


// --------------------------------------------------
// Constants
// --------------------------------------------------

const VALID_ASSESSMENTS = new Set([
    "OBSERVED",
    "INFERRED",
    "UNKNOWN",
]);

const VALID_CONFIDENCE = new Set([
    "HIGH",
    "MEDIUM",
    "LOW",
    "UNKNOWN",
]);


// --------------------------------------------------
// Errors
// --------------------------------------------------

const createError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};


// --------------------------------------------------
// Helpers
// --------------------------------------------------

const unique = (values = []) => [
    ...new Set(values.filter(Boolean)),
];

const normalizeProvider = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }

    const normalized = value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

    const aliases = {
        PAYPAL: "PAYPAL",
        HYPERWALLET: "HYPERWALLET",
    };

    return aliases[normalized] ?? normalized;
};

const normalizeIntegrationType = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toUpperCase();

    const mapping = {
        COLLECTION: "PAYMENT",
        PAYMENT: "PAYMENT",
        DISBURSEMENT: "PAYOUT",
        PAYOUT: "PAYOUT",
        BOTH: "BOTH",
        UNKNOWN: null,
    };

    return Object.prototype.hasOwnProperty.call(mapping, normalized)
        ? mapping[normalized]
        : null;
};

const createFinding = ({
    category,
    name,
    description,
    assessment,
    confidence = "UNKNOWN",
    evidenceIds = [],
    limitations = [],
    severity,
}) => ({
    category,
    name,
    description,

    assessment: VALID_ASSESSMENTS.has(assessment)
        ? assessment
        : "UNKNOWN",

    confidence: VALID_CONFIDENCE.has(confidence)
        ? confidence
        : "UNKNOWN",

    evidenceIds: unique(evidenceIds),
    limitations: unique(limitations),

    ...(severity ? { severity } : {}),
});

const evaluateFinding = (category, name, item) => {
    return createFinding({
        category,
        name,

        description:
            item.description ||
            `${name} was identified in the integration profile.`,

        assessment: item.assessment,
        confidence: item.confidence,

        evidenceIds: item.evidenceIds,
        limitations: item.limitations,
    });
};

const evaluateArray = ({
    category,
    items,
    nameField,
}) => {
    if (!Array.isArray(items)) {
        return [];
    }

    return items.map((item, index) =>
        evaluateFinding(
            category,
            item[nameField] || `${category} ${index + 1}`,
            item,
        ),
    );
};


// --------------------------------------------------
// Project Alignment
//
// This is project-context metadata.
// It is NOT part of the source assessment findings.
// --------------------------------------------------

const compareProjectValue = ({
    projectValue,
    profileValue,
    label,
}) => {
    if (!projectValue || !profileValue) {
        return {
            status: "UNVERIFIED",
            projectValue: projectValue ?? null,
            profileValue: profileValue ?? null,
            message:
                `${label} could not be compared because one or both values are unknown.`,
        };
    }

    const matches = projectValue === profileValue;

    return {
        status: matches ? "MATCH" : "MISMATCH",
        projectValue,
        profileValue,

        message: matches
            ? `${label} matches the project configuration.`
            : `${label} differs from the project configuration.`,
    };
};

const buildProjectAlignment = (integration, profile) => {
    const projectProvider = normalizeProvider(
        integration.project_provider,
    );

    const profileProvider =
        profile.provider.identificationStatus === "IDENTIFIED"
            ? normalizeProvider(profile.provider.name)
            : null;

    const projectType = normalizeIntegrationType(
        integration.project_integration_type,
    );

    const profileType = normalizeIntegrationType(
        profile.integration.type,
    );

    const provider = compareProjectValue({
        projectValue: projectProvider,
        profileValue: profileProvider,
        label: "Provider",
    });

    const integrationType = compareProjectValue({
        projectValue: projectType,
        profileValue: profileType,
        label: "Integration type",
    });

    const checks = [
        provider,
        integrationType,
    ];

    const mismatches = checks.filter(
        (item) => item.status === "MISMATCH",
    ).length;

    const unverified = checks.filter(
        (item) => item.status === "UNVERIFIED",
    ).length;

    let status = "ALIGNED";

    if (mismatches > 0) {
        status = "MISMATCH";
    } else if (unverified > 0) {
        status = "UNVERIFIED";
    }

    return {
        status,

        project: {
            id: integration.project_id,
            name: integration.project_name ?? null,
            provider: integration.project_provider ?? null,
            integrationType:
                integration.project_integration_type ?? null,
            assessmentObjective:
                integration.project_assessment_objective ?? null,
            sourceCountry:
                integration.project_source_country ?? null,
            targetCountries:
                integration.project_target_countries ?? [],
        },

        checks: {
            provider,
            integrationType,
        },

        summary: {
            totalChecks: checks.length,
            matched: checks.filter(
                (item) => item.status === "MATCH",
            ).length,
            mismatched: mismatches,
            unverified,
        },

        limitations: [
            "Project alignment compares project configuration with the confirmed Integration Profile only.",
            "A mismatch does not establish provider incompatibility or country unavailability.",
            "An unverified value must not be interpreted as a mismatch.",
            "Project alignment is separate from preliminary source assessment.",
        ],
    };
};


// --------------------------------------------------
// Evidence Reference Validation
// --------------------------------------------------

const validateEvidenceReferences = (profile) => {
    const evidenceIds = new Set(
        (profile.evidenceReferences ?? []).map(
            (reference) => reference.evidenceId,
        ),
    );

    const invalidReferences = [];

    const check = (category, name, ids = []) => {
        for (const evidenceId of ids) {
            if (!evidenceIds.has(evidenceId)) {
                invalidReferences.push({
                    category,
                    name,
                    evidenceId,
                    issue: "EVIDENCE_REFERENCE_NOT_FOUND",
                });
            }
        }
    };

    check(
        "PROVIDER",
        "Provider identification",
        profile.provider.evidenceIds,
    );

    check(
        "ARCHITECTURE",
        "Integration architecture",
        profile.architecture.evidenceIds,
    );

    for (const component of profile.architecture.components) {
        check(
            "ARCHITECTURE_COMPONENT",
            component.name,
            component.evidenceIds,
        );
    }

    for (const item of profile.capabilities) {
        check(
            "CAPABILITIES",
            item.capability,
            item.evidenceIds,
        );
    }

    for (const item of profile.apiOperations) {
        check(
            "API_OPERATIONS",
            item.name || "API operation",
            item.evidenceIds,
        );

        check(
            "API_OPERATIONS",
            item.name || "API operation",
            item.authentication?.evidenceIds ?? [],
        );
    }

    check(
        "AUTHENTICATION",
        "Authentication",
        profile.authentication.evidenceIds,
    );

    check(
        "TRANSACTION_LIFECYCLE",
        "Transaction lifecycle",
        profile.transactionLifecycle.evidenceIds,
    );

    for (const state of profile.transactionLifecycle.states) {
        check(
            "TRANSACTION_STATE",
            state.name,
            state.evidenceIds,
        );
    }

    for (const item of profile.configuration) {
        check(
            "CONFIGURATION",
            item.key,
            item.evidenceIds,
        );
    }

    for (const item of profile.dependencies) {
        check(
            "DEPENDENCIES",
            item.name,
            item.evidenceIds,
        );
    }

    for (const item of profile.securityFindings) {
        check(
            "SECURITY",
            item.title,
            item.evidenceIds,
        );
    }

    return invalidReferences;
};


// --------------------------------------------------
// Build Source Assessment
// --------------------------------------------------

const buildAssessment = (profile) => {
    const findings = [];

    // Provider identification

    findings.push(
        createFinding({
            category: "PROVIDER",
            name: "Provider identification",

            description: profile.provider.name
                ? `The source analysis identified ${profile.provider.name}.`
                : "The provider could not be established from the uploaded source.",

            assessment:
                profile.provider.identificationStatus === "IDENTIFIED"
                    ? "OBSERVED"
                    : profile.provider.identificationStatus === "POSSIBLE"
                      ? "INFERRED"
                      : "UNKNOWN",

            confidence: profile.provider.confidence,
            evidenceIds: profile.provider.evidenceIds,
        }),
    );

    // Integration type

    findings.push(
        createFinding({
            category: "INTEGRATION",
            name: "Integration type",

            description:
                `The profile identifies the integration type as ${profile.integration.type}.`,

            assessment:
                profile.integration.type === "UNKNOWN"
                    ? "UNKNOWN"
                    : "OBSERVED",

            limitations: [
                "This classification describes the integration profile and does not establish successful runtime execution.",
            ],
        }),
    );

    // Architecture

    findings.push(
        evaluateFinding(
            "ARCHITECTURE",
            "Integration architecture",
            profile.architecture,
        ),
    );

    // Architecture components

    for (const component of profile.architecture.components) {
        findings.push(
            createFinding({
                category: "ARCHITECTURE_COMPONENT",
                name: component.name,

                description:
                    component.responsibility ||
                    "The file contains extracted integration-related evidence.",

                assessment: "OBSERVED",
                confidence: "UNKNOWN",
                evidenceIds: component.evidenceIds,

                limitations: [
                    "File identification does not establish the component's complete responsibility or runtime execution.",
                ],
            }),
        );
    }

    // Capabilities

    findings.push(
        ...evaluateArray({
            category: "CAPABILITIES",
            items: profile.capabilities,
            nameField: "capability",
        }),
    );

    // API operations

    findings.push(
        ...evaluateArray({
            category: "API_OPERATIONS",
            items: profile.apiOperations,
            nameField: "name",
        }),
    );

    // Authentication

    findings.push(
        evaluateFinding(
            "AUTHENTICATION",
            "Authentication implementation",
            profile.authentication,
        ),
    );

    // Transaction lifecycle

    findings.push(
        evaluateFinding(
            "TRANSACTION_LIFECYCLE",
            "Transaction lifecycle",
            profile.transactionLifecycle,
        ),
    );

    // Transaction states

    for (const state of profile.transactionLifecycle.states) {
        findings.push(
            createFinding({
                category: "TRANSACTION_STATE",
                name: state.name,

                description:
                    state.description ||
                    `The ${state.name} lifecycle state was identified.`,

                assessment: "OBSERVED",
                confidence: "UNKNOWN",
                evidenceIds: state.evidenceIds,

                limitations: [
                    "A detected lifecycle state does not prove successful runtime transitions or a complete transaction lifecycle.",
                ],
            }),
        );
    }

    // Configuration
    // Never expose configuration values or secrets.

    for (const item of profile.configuration) {
        findings.push(
            createFinding({
                category: "CONFIGURATION",
                name: item.key,

                description:
                    `Configuration item identified: ${item.key}.`,

                assessment: item.assessment,
                confidence: "UNKNOWN",
                evidenceIds: item.evidenceIds,

                limitations: item.sensitive
                    ? [
                        "The configuration value is sensitive and is intentionally excluded from the assessment output.",
                    ]
                    : [],
            }),
        );
    }

    // Dependencies

    for (const item of profile.dependencies) {
        findings.push(
            createFinding({
                category: "DEPENDENCIES",
                name: item.name,

                description:
                    item.purpose ||
                    `Dependency ${item.name} was identified.`,

                assessment: item.assessment,
                confidence: "UNKNOWN",
                evidenceIds: item.evidenceIds,
            }),
        );
    }

    // Security findings

    for (const item of profile.securityFindings) {
        findings.push(
            createFinding({
                category: "SECURITY",
                name: item.title,
                description: item.description,
                assessment: item.assessment,
                confidence: item.confidence,
                evidenceIds: item.evidenceIds,
                limitations: item.limitations,
                severity: item.severity,
            }),
        );
    }

    return findings;
};


// --------------------------------------------------
// Summary
// --------------------------------------------------

const buildSummary = (findings, invalidEvidenceReferences) => {
    const counts = {
        total: findings.length,
        observed: 0,
        inferred: 0,
        unknown: 0,
    };

    for (const finding of findings) {
        if (finding.assessment === "OBSERVED") {
            counts.observed++;
        } else if (finding.assessment === "INFERRED") {
            counts.inferred++;
        } else {
            counts.unknown++;
        }
    }

    // Unknown findings are valid assessment outcomes.
    // They do not mean assessment execution failed.

    const status =
        invalidEvidenceReferences.length > 0
            ? "INCOMPLETE"
            : "COMPLETED";

    return {
        status,
        counts,

        invalidEvidenceReferences:
            invalidEvidenceReferences.length,

        message:
            status === "INCOMPLETE"
                ? "Source analysis completed with invalid evidence references."
                : counts.unknown > 0
                  ? "Source analysis completed successfully. Some implementation details could not be established from the uploaded source."
                  : "Source analysis completed successfully.",
    };
};


// --------------------------------------------------
// Run Preliminary Assessment
// --------------------------------------------------

export const runPreliminaryAssessment = async ({
    integrationId,
    userId,
}) => {
    // Always verify access before returning an existing assessment.

    const integration = await getIntegrationForUser(
        integrationId,
        userId,
    );

    if (!integration) {
        throw createError(
            "Integration not found or access denied.",
            404,
        );
    }

    if (integration.review_status !== "CONFIRMED") {
        throw createError(
            "The Integration Profile must be confirmed before assessment.",
            409,
        );
    }

    // Idempotency

    const existingAssessment =
        await getAssessmentByIntegration(integrationId);

    if (existingAssessment) {
        return existingAssessment;
    }

    // Validate confirmed profile

    const validation = IntegrationProfileSchema.safeParse(
        integration.integration_profile,
    );

    if (!validation.success) {
        throw createError(
            "The confirmed Integration Profile is invalid.",
            422,
        );
    }

    const profile = validation.data;

    // Source assessment

    const findings = buildAssessment(profile);

    const invalidEvidenceReferences =
        validateEvidenceReferences(profile);

    const summary = buildSummary(
        findings,
        invalidEvidenceReferences,
    );

    // Separate project alignment metadata.
    // It does not affect source assessment findings or status.

    const projectAlignment = buildProjectAlignment(
        integration,
        profile,
    );

    const result = {
        assessmentType: "PRELIMINARY_SOURCE",

        scope: {
            sourceAnalysis: true,
            confirmedProfile: true,

            projectAlignment: true,

            credentials: false,
            sandboxVerification: false,
            countryRequirements: false,
            productionReadiness: false,
        },

        summary,

        findings,

        projectAlignment,

        evidenceValidation: {
            valid: invalidEvidenceReferences.length === 0,
            invalidReferences: invalidEvidenceReferences,
        },

        profileLimitations: profile.limitations ?? [],

        limitations: [
            "This assessment is based exclusively on the uploaded source and developer-confirmed Integration Profile.",
            "Observed findings do not establish successful runtime execution.",
            "Inferred findings are not verified implementation facts.",
            "Unknown findings must not be interpreted as proof that an implementation is missing.",
            "Project alignment is informational and is not a provider compatibility assessment.",
            "Provider capabilities, country requirements and Sandbox operations are evaluated in later stages.",
        ],

        generatedAt: new Date().toISOString(),
    };

    const saved = await createAssessmentRun({
        integrationId,
        assessmentStatus: summary.status,
        result,
        userId,
    });

    // Handle concurrent requests safely.

    if (!saved) {
        const concurrentAssessment =
            await getAssessmentByIntegration(integrationId);

        if (concurrentAssessment) {
            return concurrentAssessment;
        }

        throw createError(
            "Unable to save the preliminary assessment.",
            500,
        );
    }

    return saved;
};
