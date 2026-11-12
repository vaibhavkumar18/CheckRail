import { z } from "zod";

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

export const paypalCredentialsSchema = z.object({
    clientId: clientIdSchema,
    clientSecret: clientSecretSchema,
    webhookId: webhookIdSchema,
}).strict();

export const paypalUpdateCredentialsSchema = paypalCredentialsSchema;
