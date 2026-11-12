
import { useCallback, useState } from "react";

import {
    startGapAnalysis,
    getGapAnalysisRun,
} from "../api/gapAnalysis.api";

const getData = (response) =>
    response?.data?.data || response?.data || response;

const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message ||
    error?.message ||
    fallback;

export default function useGapAnalysis() {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const start = useCallback(async (projectId, capabilityId) => {
        setSubmitting(true);
        setError("");

        try {
            const response = await startGapAnalysis(
                projectId,
                capabilityId
            );

            const data = getData(response);
            const result = data?.analysis || data?.run || data;

            setAnalysis(result);
            return result;
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Unable to start AI Gap Analysis."
                )
            );
            throw err;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const load = useCallback(async (projectId, runId) => {
        setLoading(true);
        setError("");

        try {
            const response = await getGapAnalysisRun(
                projectId,
                runId
            );

            const data = getData(response);
            const result = data?.analysis || data?.run || data;

            setAnalysis(result);
            return result;
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    "Unable to load AI Gap Analysis report."
                )
            );
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        analysis,
        loading,
        submitting,
        error,
        start,
        load,
    };
}
