
import api from "../../../api/axios";

/**
 * Project API.
 *
 * Existing project CRUD/overview operations and Project Workflow
 * operations are intentionally kept in this existing API module.
 */

const RESTORE_TIMEOUT = 30000;
const LONG_OPERATION_TIMEOUT = 120000;

// -----------------------------------------------------------------------------
// Existing project operations
// -----------------------------------------------------------------------------

export const getProjects = async (organizationId = null) => {
    const endpoint = organizationId
        ? `/${organizationId}/projects`
        : "/";

    const response = await api.get(`/projects${endpoint}`);
    return response.data;
};

export const getProject = async (projectId) => {
    const response = await api.get(`/projects/${projectId}`, {
        timeout: RESTORE_TIMEOUT,
    });

    return response.data;
};

export const getProjectOverview = async (projectId) => {
    const response = await api.get(
        `/projects/${projectId}/overview`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const createProject = async (organizationId, payload) => {
    const response = await api.post(
        `/projects/${organizationId}/createProject`,
        payload
    );

    return response.data;
};

export const updateProject = async (projectId, payload) => {
    const response = await api.patch(
        `/projects/${projectId}/updateProject`,
        payload
    );

    return response.data;
};

export const deleteProject = async (projectId) => {
    const response = await api.delete(
        `/projects/${projectId}/deleteProject`
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: restoration
// -----------------------------------------------------------------------------

export const getWorkflowIntegrationPreview = async (integrationId) => {
    const response = await api.get(
        `/integration/integrations/${integrationId}/preview`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const getWorkflowCredentials = async (integrationId) => {
    const response = await api.get(
        `/credentials/integrations/${integrationId}/credentials`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const getWorkflowCountryRun = async (projectId, runId) => {
    const response = await api.get(
        `/country-intelligence/${projectId}/country-intelligence/runs/${runId}`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const getWorkflowCountryProfile = async (
    projectId,
    intelligenceId
) => {
    const response = await api.get(
        `/country-intelligence/${projectId}/country-intelligence/${intelligenceId}`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const getWorkflowCapabilityRun = async (runId) => {
    const response = await api.get(
        `/capability-verification/runs/${runId}`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const getWorkflowAnalysisRun = async (projectId, runId) => {
    const response = await api.get(
        `/ai-analysis/projects/${projectId}/runs/${runId}`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: Integration Intelligence
// -----------------------------------------------------------------------------

export const uploadWorkflowIntegration = async (projectId, formData) => {
    const response = await api.post(
        `/integration/${projectId}/integration`,
        formData,
        {
            timeout: LONG_OPERATION_TIMEOUT,
            headers: {
                "Content-Type": "multipart/form-data",
            },
        }
    );

    return response.data;
};

export const updateWorkflowIntegrationProfile = async (
    integrationId,
    profile
) => {
    const response = await api.patch(
        `/integration/integrations/${integrationId}/preview`,
        { profile },
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const confirmWorkflowIntegration = async (integrationId) => {
    const response = await api.post(
        `/integration/integrations/${integrationId}/confirm`,
        {},
        { timeout: LONG_OPERATION_TIMEOUT }
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: Country Intelligence
// -----------------------------------------------------------------------------

export const startWorkflowCountryIntelligence = async (projectId) => {
    const response = await api.post(
        `/country-intelligence/${projectId}/country-intelligence/runs`,
        {},
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: credentials
// -----------------------------------------------------------------------------

export const createWorkflowCredentials = async (
    integrationId,
    payload
) => {
    const response = await api.post(
        `/credentials/integrations/${integrationId}/credentials`,
        payload,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

export const updateWorkflowCredentials = async (
    integrationId,
    credentialId,
    payload
) => {
    const response = await api.patch(
        `/credentials/integrations/${integrationId}/credentials/${credentialId}`,
        payload,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: unified credential + capability verification
// -----------------------------------------------------------------------------

export const startWorkflowVerification = async (
    credentialId,
    payload
) => {
    const response = await api.post(
        `/verification/credentials/${credentialId}/verify-integration`,
        payload,
        { timeout: LONG_OPERATION_TIMEOUT }
    );

    return response.data;
};

export const resumeWorkflowVerification = async (capabilityRunId) => {
    const response = await api.post(
        `/verification/capability-runs/${capabilityRunId}/resume`,
        {},
        { timeout: LONG_OPERATION_TIMEOUT }
    );

    return response.data;
};

// -----------------------------------------------------------------------------
// Project Workflow: AI Gap Analysis
// -----------------------------------------------------------------------------

export const startWorkflowGapAnalysis = async (projectId, payload) => {
    const response = await api.post(
        `/ai-analysis/projects/${projectId}`,
        payload,
        { timeout: LONG_OPERATION_TIMEOUT }
    );

    return response.data;
};

export const refreshWorkflowGapAnalysis = async (projectId, runId) => {
    const response = await api.get(
        `/ai-analysis/projects/${projectId}/runs/${runId}`,
        { timeout: RESTORE_TIMEOUT }
    );

    return response.data;
};
