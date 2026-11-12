import { z } from "zod";

export const paypalCredentialsSchema = z.object({
    clientId: z.string().trim().min(1).max(500),
    clientSecret: z.string().min(1).max(5000),
    webhookId: z.string().nullable().optional(),
}).strict();

export const validatePayPalCredentials = (credentials) => {
    return paypalCredentialsSchema.safeParse(credentials);
};