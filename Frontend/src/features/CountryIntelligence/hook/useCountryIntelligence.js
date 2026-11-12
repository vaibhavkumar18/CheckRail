import { useCallback, useState } from "react";

import {
    startCountryIntelligence,
    getCountryIntelligenceRun,
    getCountryIntelligenceProfiles,
    getCountryIntelligenceProfile,
} from "../api/countryIntelligence.api";

const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || error?.message || fallback;

const getData = (response) =>
    response?.data?.data || response?.data || response;

export default function useCountryIntelligence() {
    const [run, setRun] = useState(null);
    const [profiles, setProfiles] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const start = useCallback(async (projectId) => {
        setSubmitting(true);
        setError("");

        try {
            const response = await startCountryIntelligence(projectId);
            const data = getData(response);
            setRun(data);
            return data;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to start Country Intelligence."));
            throw err;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const loadRun = useCallback(async (projectId, runId) => {
        setLoading(true);
        setError("");

        try {
            const response = await getCountryIntelligenceRun(projectId, runId);
            const data = getData(response);
            setRun(data);
            return data;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to load Country Intelligence run."));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const loadProfiles = useCallback(async (projectId) => {
        setLoading(true);
        setError("");

        try {
            const response = await getCountryIntelligenceProfiles(projectId);
            const data = getData(response);
            const records = data?.profiles || [];
            setProfiles(records);
            return records;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to load country profiles."));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const loadProfile = useCallback(async (projectId, intelligenceId) => {
        setLoading(true);
        setError("");

        try {
            const response = await getCountryIntelligenceProfile(
                projectId,
                intelligenceId
            );

            const data = getData(response);
            setProfile(data);
            return data;
        } catch (err) {
            setError(getErrorMessage(err, "Unable to load country profile."));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        run,
        profiles,
        profile,
        loading,
        submitting,
        error,
        start,
        loadRun,
        loadProfiles,
        loadProfile,
    };
}