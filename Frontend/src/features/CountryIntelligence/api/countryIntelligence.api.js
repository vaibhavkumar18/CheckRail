import api from "../../../api/axios";

export const startCountryIntelligence = async (projectId) => {
    const response = await api.post(
        `/country-intelligence/${projectId}/country-intelligence/runs`
    );

    return response.data;
};

export const getCountryIntelligenceRun = async (projectId, runId) => {
    const response = await api.get(
        `/country-intelligence/${projectId}/country-intelligence/runs/${runId}`
    );

    return response.data;
};

export const getCountryIntelligenceProfiles = async (projectId) => {
    const response = await api.get(
        `/country-intelligence/${projectId}/country-intelligence`
    );

    return response.data;
};

export const getCountryIntelligenceProfile = async (
    projectId,
    intelligenceId
) => {
    const response = await api.get(
        `/country-intelligence/${projectId}/country-intelligence/${intelligenceId}`
    );

    return response.data;
};