import { useCallback, useState } from "react";

import {
    uploadIntegration,
    getAllIntegrations,
    getIntegrationsForProject,
    getIntegrationPreview,
    confirmIntegration,
    updateIntegrationPreview,
} from "../api/integration.api";

const extractIntegrations = (response) => {
    if (Array.isArray(response)) return response;

    const candidates = [
        response?.integrations,
        response?.data?.integrations,
        response?.data?.data?.integrations,
        response?.data,
    ];

    return candidates.find(Array.isArray) || [];
};

const extractIntegration = (response) =>
    response?.integration ||
    response?.data?.integration ||
    response?.data ||
    response;

export default function useIntegration() {
    const [integrations, setIntegrations] = useState([]);
    const [integration, setIntegration] = useState(null);

    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState(null);

    // Load all Integration Profiles the signed-in user can access.
    // Used by the global /integrations page.
    const loadAllIntegrations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await getAllIntegrations();
            const records = extractIntegrations(response);

            setIntegrations(records);
            return records;
        } catch (err) {
            const message =
                err.response?.data?.message ||
                "Unable to load integrations.";

            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Upload and analyse an integration for a project.
    const startIntegration = useCallback(async (projectId, file) => {
        try {
            setLoading(true);
            setError(null);

            return await uploadIntegration(projectId, file);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to analyse integration."
            );
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Load Integration Profiles belonging to one project.
    const loadProjectIntegrations = useCallback(async (projectId) => {
        try {
            setLoading(true);
            setError(null);

            const response = await getIntegrationsForProject(projectId);
            const records = extractIntegrations(response);

            setIntegrations(records);
            return records;
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load Integration Profiles."
            );
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Load one Integration Profile for its report page.
    const loadIntegration = useCallback(async (integrationId) => {
        try {
            setLoading(true);
            setError(null);

            const response = await getIntegrationPreview(integrationId);
            const record = extractIntegration(response);

            setIntegration(record);
            return record;
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load Integration Profile."
            );
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Update a pending Integration Profile.
    const updateProfile = useCallback(async (integrationId, profile) => {
        try {
            setConfirming(true);
            setError(null);

            const response = await updateIntegrationPreview(
                integrationId,
                profile
            );

            const updated = extractIntegration(response);

            setIntegration((previous) => ({
                ...previous,
                ...updated,
            }));

            return response;
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to update Integration Profile."
            );
            throw err;
        } finally {
            setConfirming(false);
        }
    }, []);

    // Confirm a pending Integration Profile.
    const confirm = useCallback(async (integrationId) => {
        try {
            setConfirming(true);
            setError(null);

            const response = await confirmIntegration(integrationId);
            return response;
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to confirm Integration."
            );
            throw err;
        } finally {
            setConfirming(false);
        }
    }, []);

    return {
        integrations,
        integration,
        loading,
        confirming,
        error,

        loadAllIntegrations,
        startIntegration,
        loadProjectIntegrations,
        loadIntegration,
        updateProfile,
        confirm,
    };
}
