
export const HYPERWALLET_PROVIDER = "HYPERWALLET";

export const HYPERWALLET_ENVIRONMENTS = {
    SANDBOX: "SANDBOX",
    UAT: "UAT",
    LIVE: "LIVE"
};

export function normalizeHyperwalletCredentials(input) {
    return {
        provider: HYPERWALLET_PROVIDER,
        environment: input.environment,
        username: input.username.trim(),
        password: input.password,
        programToken: input.programToken?.trim() || null
    };
}
