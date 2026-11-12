
import { z } from "zod";

export const hyperwalletCredentialsSchema = z.object({
    username: z.string().trim().min(1).max(500),
    password: z.string().min(1).max(5000),
    programToken: z.string().trim().min(1).max(500),
}).strict();

export const validateHyperwalletCredentials = (credentials) => {
    return hyperwalletCredentialsSchema.safeParse(credentials);
};
