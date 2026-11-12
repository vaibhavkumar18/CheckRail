import api from "../../../api/axios";

export const getIntegrationCredentials = async (integrationId) => {
    const response = await api.get(
        `/credentials/integrations/${integrationId}/credentials`
    );

    return response.data;
};

export const createIntegrationCredentials = async (
    integrationId,
    payload
) => {
    const response = await api.post(
        `/credentials/integrations/${integrationId}/credentials`,
        payload
    );

    return response.data;
};

export const updateIntegrationCredentials = async (
    integrationId,
    credentialId,
    payload
) => {
    const response = await api.patch(
        `/credentials/integrations/${integrationId}/credentials/${credentialId}`,
        payload
    );

    return response.data;
};

export const deleteIntegrationCredentials = async (
    integrationId,
    credentialId
) => {
    const response = await api.delete(
        `/credentials/integrations/${integrationId}/credentials/${credentialId}`
    );

    return response.data;
};