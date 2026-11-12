import api from "../../../api/axios";

export const startGapAnalysis = async (projectId, capabilityId) => {
    const response = await api.post(
        `/ai-analysis/projects/${projectId}`,
        { capabilityId }
    );

    return response.data;
};

export const getGapAnalysisRun = async (projectId, runId) => {
    const response = await api.get(
        `/ai-analysis/projects/${projectId}/runs/${runId}`
    );

    return response.data;
};