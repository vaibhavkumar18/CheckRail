import api from "../../../api/axios";

// --------------------------------------------------
// Global Integrations
// --------------------------------------------------

export const getAllIntegrations = async () => {
    const response = await api.get("/integration");
    return response.data;
};

// --------------------------------------------------
// Project Integrations
// --------------------------------------------------

export const getIntegrationsForProject = async (projectId) => {
    const response = await api.get(
        `/integration/projects/${projectId}/integrations`
    );

    return response.data;
};

// --------------------------------------------------
// Integration Report
// --------------------------------------------------

export const getIntegrationPreview = async (integrationId) => {
    const response = await api.get(
        `/integration/integrations/${integrationId}/preview`
    );

    return response.data;
};

// --------------------------------------------------
// Update Integration Profile
// --------------------------------------------------

export const updateIntegrationPreview = async (
    integrationId,
    profile
) => {
    const response = await api.patch(
        `/integration/integrations/${integrationId}/preview`,
        { profile }
    );

    return response.data;
};

// --------------------------------------------------
// Confirm Integration
// --------------------------------------------------

export const confirmIntegration = async (integrationId) => {
    const response = await api.post(
        `/integration/integrations/${integrationId}/confirm`
    );

    return response.data;
};

// --------------------------------------------------
// Upload Integration
// --------------------------------------------------

export const uploadIntegration = async (projectId, file) => {
    const formData = new FormData();

    formData.append("file", file);

    const response = await api.post(
        `/integration/${projectId}/integration`,
        formData
    );

    return response.data;
};