
export const normalizeVerificationResult = ({
    provider,
    environment,
    checks,
    evidence = [],
}) => {
    const passed = checks.filter(
        (check) => check.status === "PASSED"
    ).length;

    const failed = checks.filter(
        (check) => check.status === "FAILED"
    ).length;

    const notRun = checks.filter(
        (check) => check.status === "NOT_RUN"
    ).length;

    // Authentication or credential validation failure
    // makes the entire verification unsuccessful.
    const criticalFailure = checks.some(
        (check) =>
            [
                "CREDENTIAL_VALIDATION",
                "AUTHENTICATION",
            ].includes(check.name) &&
            check.status === "FAILED"
    );

    let status = "SUCCESS";

    if (criticalFailure) {
        status = "FAILED";
    } else if (failed > 0 && passed > 0) {
        status = "PARTIAL_SUCCESS";
    } else if (failed > 0 || passed === 0) {
        status = "FAILED";
    }

    return {
        provider,
        environment,
        status,

        summary: {
            total: checks.length,
            passed,
            failed,
            notRun,
        },

        checks,
        evidence,
        completedAt: new Date().toISOString(),
    };
};

