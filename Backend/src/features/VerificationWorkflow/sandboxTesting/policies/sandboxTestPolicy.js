export const SANDBOX_TEST_POLICY = Object.freeze({
    allowedEnvironment: "SANDBOX",

    allowLiveEnvironment: false,

    stopOnFailure: true,

    stopOnUnknownOutcome: true,

    retryWriteOperations: false,

    allowedCheckStatuses: [
        "PASSED",
        "FAILED",
        "NOT_RUN",
    ],
});