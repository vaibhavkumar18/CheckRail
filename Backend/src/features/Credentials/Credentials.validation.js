
import { z } from "zod";

// --------------------------------------------------
// Common Validations
// --------------------------------------------------

const uuidSchema = z.string().uuid("Invalid UUID format.");

const clientIdSchema = z.string()
    .trim()
    .min(1, "PayPal Client ID is required.")
    .max(500, "Client ID is too long.");

const clientSecretSchema = z.string()
    .min(1, "PayPal Client Secret is required.")
    .max(5000, "Client Secret is too long.");

const webhookIdSchema = z.string()
    .trim()
    .max(255, "Webhook ID is too long.")
    .optional()
    .nullable();

// --------------------------------------------------
// Hyperwallet Validations
// --------------------------------------------------

const hyperwalletUsernameSchema = z.string()
    .trim()
    .min(1, "Hyperwallet API username is required.")
    .max(500, "Username is too long.");

const hyperwalletPasswordSchema = z.string()
    .min(1, "Hyperwallet API password is required.")
    .max(5000, "Password is too long.");

const programTokenSchema = z.string()
    .trim()
    .min(1, "Hyperwallet Program Token is required.")
    .max(1000, "Program token is too long.");

// --------------------------------------------------
// Provider Credential Schemas
// --------------------------------------------------

const paypalCredentialsSchema = z.object({
    clientId: clientIdSchema,
    clientSecret: clientSecretSchema,
    webhookId: webhookIdSchema,
}).strict();

const hyperwalletCredentialsSchema = z.object({
    username: hyperwalletUsernameSchema,
    password: hyperwalletPasswordSchema,
    programToken: programTokenSchema,
}).strict();

// --------------------------------------------------
// Create Credentials Schema
// --------------------------------------------------

export const createCredentialsSchema = z.discriminatedUnion(
    "provider",
    [
        z.object({
            provider: z.literal("PAYPAL"),
            environment: z.literal("SANDBOX"),
            credentials: paypalCredentialsSchema,
        }).strict(),

        z.object({
            provider: z.literal("HYPERWALLET"),
            environment: z.enum(["SANDBOX", "UAT", "LIVE"]),
            credentials: hyperwalletCredentialsSchema,
        }).strict(),
    ]
);

// --------------------------------------------------
// Update Credentials Schema
// Provider must match the existing database record.
// --------------------------------------------------

export const updateCredentialsSchema = z.discriminatedUnion(
    "provider",
    [
        z.object({
            provider: z.literal("PAYPAL"),
            credentials: paypalCredentialsSchema,
        }).strict(),

        z.object({
            provider: z.literal("HYPERWALLET"),
            credentials: hyperwalletCredentialsSchema,
        }).strict(),
    ]
);

// --------------------------------------------------
// Route Parameter Schemas
// --------------------------------------------------

export const integrationIdSchema = z.object({
    integrationId: uuidSchema,
});

export const credentialParamsSchema = z.object({
    integrationId: uuidSchema,
    credentialId: uuidSchema,
});

// --------------------------------------------------
// Validation Middleware
// --------------------------------------------------

const handleValidation = (schema, source) => {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed.",
                errors: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        req[source] = result.data;
        next();
    };
};

// --------------------------------------------------
// Exported Middleware
// --------------------------------------------------

export const validateCreateCredentials = handleValidation(
    createCredentialsSchema,
    "body"
);

export const validateUpdateCredentials = handleValidation(
    updateCredentialsSchema,
    "body"
);

export const validateIntegrationId = handleValidation(
    integrationIdSchema,
    "params"
);

export const validateCredentialParams = handleValidation(
    credentialParamsSchema,
    "params"
);
