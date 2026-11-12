
import { z } from "zod";

const verificationParamsSchema = z.object({
    integrationId: z.string().uuid(),
    provider: z.enum(["PAYPAL", "HYPERWALLET"]),
}).strict();

const verificationBodySchema = z.object({
    environment: z.literal("SANDBOX"),
}).strict();

const credentialVerificationParamsSchema = z.object({
    credentialId: z.string().uuid(),
}).strict();

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

const sandboxInputSchema = z.object({
    recipient: z.record(z.unknown()).optional(),
    bankAccount: z.record(z.unknown()).optional(),
    payment: z.object({
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
        currency: z.string().regex(/^[A-Z]{3}$/),
        purpose: z.string().min(1),
        memo: z.string().optional(),
        notes: z.string().optional(),
    }).strict().optional(),
}).strict();

const credentialVerificationBodySchema = z.object({
    capabilityCode: z.enum([
        "PAYMENT_PROCESSING",
        "RECIPIENT_MANAGEMENT",
        "PAYMENT_DISBURSEMENT",
    ]).optional(),

    sandboxInput: sandboxInputSchema.optional(),
}).strict().superRefine((value, context) => {

    // Recipient Management retains its existing manual-input
    // validation behavior.
    if (
        value.capabilityCode === "RECIPIENT_MANAGEMENT" &&
        !value.sandboxInput?.recipient
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sandboxInput", "recipient"],
            message: "Recipient management requires Sandbox recipient profile details.",
        });
    }

    // PAYMENT_DISBURSEMENT intentionally does not require
    // sandboxInput. Recipient, bank account and payment fixtures
    // are resolved by the backend using the authorized project's
    // target country.
});

const capabilityResumeParamsSchema = z.object({
    runId: z.string().uuid(),
}).strict();

export const validateVerificationParams = handleValidation(
    verificationParamsSchema,
    "params"
);

export const validateVerificationBody = handleValidation(
    verificationBodySchema,
    "body"
);

export const validateCredentialVerificationParams = handleValidation(
    credentialVerificationParamsSchema,
    "params"
);

export const validateCapabilityResumeParams = handleValidation(
    capabilityResumeParamsSchema,
    "params"
);

export const validateCredentialVerificationBody = handleValidation(
    credentialVerificationBodySchema,
    "body"
);
