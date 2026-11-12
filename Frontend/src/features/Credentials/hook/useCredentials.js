import { useCallback, useState } from "react";

import {
    getIntegrationCredentials,
    createIntegrationCredentials,
    updateIntegrationCredentials,
    deleteIntegrationCredentials,
} from "../api/credentials.api";

const extractCredentials = (response) => {
    const candidates = [
        response?.credentials,
        response?.data?.credentials,
        response?.data?.data?.credentials,
        response?.data,
    ];

    return candidates.find(Array.isArray) || [];
};

const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

export default function useCredentials() {
    const [credentials, setCredentials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async (integrationId) => {
        if (!integrationId) {
            setCredentials([]);
            return [];
        }

        setLoading(true);
        setError("");

        try {
            const response = await getIntegrationCredentials(integrationId);
            const records = extractCredentials(response);
            setCredentials(records);
            return records;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to load credentials."));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const create = useCallback(async (integrationId, payload) => {
        setSubmitting(true);
        setError("");

        try {
            const response = await createIntegrationCredentials(
                integrationId,
                payload
            );

            await load(integrationId);
            return response;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to save credentials."));
            throw err;
        } finally {
            setSubmitting(false);
        }
    }, [load]);

    const update = useCallback(async (
        integrationId,
        credentialId,
        payload
    ) => {
        setSubmitting(true);
        setError("");

        try {
            const response = await updateIntegrationCredentials(
                integrationId,
                credentialId,
                payload
            );

            await load(integrationId);
            return response;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to update credentials."));
            throw err;
        } finally {
            setSubmitting(false);
        }
    }, [load]);

    const remove = useCallback(async (integrationId, credentialId) => {
        setSubmitting(true);
        setError("");

        try {
            const response = await deleteIntegrationCredentials(
                integrationId,
                credentialId
            );

            await load(integrationId);
            return response;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to delete credentials."));
            throw err;
        } finally {
            setSubmitting(false);
        }
    }, [load]);

    return {
        credentials,
        loading,
        submitting,
        error,
        load,
        create,
        update,
        remove,
    };
}