
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    startCapabilityVerification,
    resumeCapabilityVerification,
    getCapabilityRuns,
    getLatestCapabilityRuns,
    getAllVerificationRuns,
    getCapabilityRunDetails,
} from "../api/verification.api";

import {
    setVerificationLoading,
    setVerificationError,
    setVerificationResult,
    setVerificationRuns,
    setVerificationRunDetails,
    clearVerificationError,
} from "../state/verificationSlice";

const extractRuns = (response) => {
    const candidates = [
        response?.runs,
        response?.capabilityRuns,
        response?.data?.runs,
        response?.data?.capabilityRuns,
        response?.data,
        response,
    ];

    return candidates.find(Array.isArray) || [];
};

const extractRun = (response) =>
    response?.run ||
    response?.data?.run ||
    response?.data?.data?.run ||
    response?.data ||
    response;

export default function useCapabilityVerification() {
    const dispatch = useDispatch();

    const {
        result,
        runs,
        runDetails,
        loading,
        error,
    } = useSelector((state) => state.verification);

    const execute = useCallback(async (callback, fallbackMessage) => {
        dispatch(setVerificationLoading(true));
        dispatch(clearVerificationError());

        try {
            return await callback();
        } catch (err) {
            dispatch(
                setVerificationError(
                    err?.response?.data?.message || fallbackMessage
                )
            );

            throw err;
        } finally {
            dispatch(setVerificationLoading(false));
        }
    }, [dispatch]);

    const start = useCallback(async (credentialId, payload) => {
        return execute(async () => {
            const response = await startCapabilityVerification(
                credentialId,
                payload
            );

            dispatch(setVerificationResult(response));

            return response;
        }, "Capability verification failed.");
    }, [dispatch, execute]);

    const resume = useCallback(async (runId) => {
        return execute(async () => {
            const response = await resumeCapabilityVerification(runId);

            dispatch(setVerificationResult(response));

            return response;
        }, "Unable to resume verification.");
    }, [dispatch, execute]);

    const loadRuns = useCallback(async (projectId) => {
        return execute(async () => {
            const response = await getCapabilityRuns(projectId);
            const records = extractRuns(response);

            dispatch(setVerificationRuns(records));

            return records;
        }, "Unable to load verification history.");
    }, [dispatch, execute]);

    const loadLatest = useCallback(async (projectId) => {
        return execute(async () => {
            const response = await getLatestCapabilityRuns(projectId);
            const records = extractRuns(response);

            dispatch(setVerificationRuns(records));

            return records;
        }, "Unable to load latest verification.");
    }, [dispatch, execute]);

    const loadAllRuns = useCallback(async () => {
        return execute(async () => {
            const response = await getAllVerificationRuns();
            const records = extractRuns(response);

            dispatch(setVerificationRuns(records));

            return records;
        }, "Unable to load verification history.");
    }, [dispatch, execute]);

    const loadRunDetails = useCallback(async (runId) => {
        return execute(async () => {
            const response = await getCapabilityRunDetails(runId);
            const record = extractRun(response);

            dispatch(setVerificationRunDetails(record));

            return record;
        }, "Unable to load verification report.");
    }, [dispatch, execute]);

    return {
        result,
        runs,
        runDetails,
        loading,
        error,
        start,
        resume,
        loadRuns,
        loadLatest,
        loadAllRuns,
        loadRunDetails,
    };
}
