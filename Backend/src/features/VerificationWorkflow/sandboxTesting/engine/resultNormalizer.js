import {
    normalizeCapabilityResult,
} from "../../../CapabilityVerification/utils/normalizeCapabilityResult.js";

export const normalizeScenarioResult = ({
    provider,
    environment,
    capabilityCode,
    scenarioId,
    checks,
    evidence,
}) => {
    const result = normalizeCapabilityResult({
        provider,
        environment,
        capabilityCode,
        checks,
        evidence,
    });

    return {
        ...result,
        scenarioId,
    };
};

export const createNotRunScenarioResult = ({
    provider,
    environment,
    capabilityCode,
    message,
}) => {
    return normalizeCapabilityResult({
        provider,
        environment,
        capabilityCode,

        checks: [
            {
                name: "SANDBOX_SCENARIO_CONFIGURATION",
                status: "NOT_RUN",
                message,
            },
        ],

        evidence: [],
    });
};