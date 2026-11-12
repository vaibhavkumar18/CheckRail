import api from "../../../api/axios";

export const startCapabilityVerification = async (
    credentialId,
    payload
) => {
    const response = await api.post(
        `/verification/credentials/${credentialId}/verify-integration`,
        payload
    );

    return response.data;
};

export const resumeCapabilityVerification = async (capabilityRunId) => {
    const response = await api.post(
        `/verification/capability-runs/${capabilityRunId}/resume`
    );

    return response.data;
};

export const getCapabilityRuns = async (projectId) => {
    const response = await api.get(
        `/capability-verification/projects/${projectId}/runs`
    );

    return response.data;
};

export const getLatestCapabilityRuns = async (projectId) => {
    const response = await api.get(
        `/capability-verification/projects/${projectId}/latest`
    );

    return response.data;
};

export const getAllVerificationRuns = async () => {
    const response = await api.get("/capability-verification");
    return response.data;
};

export const getCapabilityRunDetails = async (runId) => {
    const response = await api.get(
        `/capability-verification/runs/${runId}`
    );

    return response.data;
};