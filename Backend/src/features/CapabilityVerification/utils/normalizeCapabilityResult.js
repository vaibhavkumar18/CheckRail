
const VALID_STATUSES = [
    "PENDING",
    "RUNNING",
    "PASSED",
    "FAILED",
    "BLOCKED",
    "SKIPPED",
    "UNSUPPORTED",
    "NOT_RUN",
    "UNKNOWN",
];

export const normalizeCapabilityResult = ({
    provider,
    environment,
    capabilityCode,
    checks = [],
    evidence = [],
}) => {
    if (!Array.isArray(checks) || !Array.isArray(evidence)) {
        throw new Error("Checks and evidence must be arrays.");
    }

    if (
        checks.some(
            (check) => !VALID_STATUSES.includes(check.status)
        )
    ) {
        throw new Error("Invalid capability check status.");
    }

    const passed = checks.filter(
        (check) => check.status === "PASSED"
    ).length;

    const failed = checks.filter(
        (check) => check.status === "FAILED"
    ).length;

    const notRun = checks.filter(
        (check) => check.status === "NOT_RUN"
    ).length;

    const unknown = checks.filter(
        (check) => check.status === "UNKNOWN"
    ).length;

    let status = "UNVERIFIED";

    if (failed > 0 || unknown > 0) {
        status = "FAILED";
    } else if (
        checks.length > 0 &&
        passed === checks.length
    ) {
        status = "VERIFIED";
    }

    return {
        provider,
        environment,
        capabilityCode,
        status,
        summary: {
            total: checks.length,
            passed,
            failed,
            notRun,
            unknown,
        },
        checks,
        evidence,
        completedAt: new Date().toISOString(),
    };
};
