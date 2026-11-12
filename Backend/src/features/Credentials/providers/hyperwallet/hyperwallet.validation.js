
import { z } from "zod";

export const hyperwalletCredentialSchema = z.object({
    provider: z.literal("HYPERWALLET"),
    environment: z.enum(["SANDBOX", "UAT", "LIVE"]),

    username: z.string()
        .trim()
        .min(1, "Hyperwallet API username is required"),

    password: z.string()
        .min(1, "Hyperwallet API password is required"),

    programToken: z.string()
        .trim()
        .optional()
        .nullable()
});
