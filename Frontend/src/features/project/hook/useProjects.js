
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    setProjects,
    setSelectedProject,
    setProjectLoading,
    setProjectSubmitting,
    setProjectError,
    setWorkflowRequestState,
    setWorkflowRequestError,
    clearWorkflowRequestError,
} from "../state/projectSlice";

import * as projectApi from "../api/project.api";

const getErrorMessage = (error, fallback = "Something went wrong.") =>
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback;

const extractProject = (response) =>
    response?.project ||
    response?.data?.project ||
    response?.data ||
    response;

const extractProjects = (response) => {
    const data =
        response?.projects ||
        response?.data?.projects ||
        response?.data ||
        response;

    return Array.isArray(data) ? data : [];
};

const extractOverview = (response) =>
    response?.data || response;

/**
 * Existing project hook extended with all Project Workflow operations.
 *
 * Page -> useProjects hook -> projectSlice + project.api.js
 * No Axios calls belong in page components.
 */
export default function useProjects() {
    const dispatch = useDispatch();

    const {
        projects,
        selectedProject,
        loading,
        submitting,
        error,
        workflowRequests = {},
        workflowError,
    } = useSelector((state) => state.project);

    const executeWorkflowRequest = useCallback(
        async (key, callback, fallbackMessage) => {
            dispatch(clearWorkflowRequestError(key));

            dispatch(
                setWorkflowRequestState({
                    key,
                    loading: true,
                })
            );

            try {
                return await callback();
            } catch (requestError) {
                dispatch(
                    setWorkflowRequestError({
                        key,
                        error: getErrorMessage(
                            requestError,
                            fallbackMessage
                        ),
                    })
                );

                throw requestError;
            } finally {
                dispatch(
                    setWorkflowRequestState({
                        key,
                        loading: false,
                    })
                );
            }
        },
        [dispatch]
    );

    // -------------------------------------------------------------------------
    // Existing project operations
    // -------------------------------------------------------------------------

    const loadProjects = useCallback(
        async (organizationId = null) => {
            dispatch(setProjectLoading(true));
            dispatch(setProjectError(null));

            try {
                const response = await projectApi.getProjects(
                    organizationId
                );

                const projectList = extractProjects(response);
                dispatch(setProjects(projectList));

                return projectList;
            } catch (requestError) {
                dispatch(
                    setProjectError(getErrorMessage(requestError))
                );
                throw requestError;
            } finally {
                dispatch(setProjectLoading(false));
            }
        },
        [dispatch]
    );

    const loadProject = useCallback(
        async (projectId) => {
            dispatch(setProjectLoading(true));
            dispatch(setProjectError(null));

            try {
                const response = await projectApi.getProject(projectId);
                const project = extractProject(response);

                dispatch(setSelectedProject(project || null));

                return project;
            } catch (requestError) {
                dispatch(
                    setProjectError(getErrorMessage(requestError))
                );
                throw requestError;
            } finally {
                dispatch(setProjectLoading(false));
            }
        },
        [dispatch]
    );

    const loadProjectOverview = useCallback(
        async (projectId) => {
            dispatch(setProjectLoading(true));
            dispatch(setProjectError(null));

            try {
                const response =
                    await projectApi.getProjectOverview(projectId);

                return extractOverview(response);
            } catch (requestError) {
                dispatch(
                    setProjectError(getErrorMessage(requestError))
                );
                throw requestError;
            } finally {
                dispatch(setProjectLoading(false));
            }
        },
        [dispatch]
    );

    const create = useCallback(
        async (organizationId, payload) => {
            dispatch(setProjectSubmitting(true));
            dispatch(setProjectError(null));

            try {
                const response = await projectApi.createProject(
                    organizationId,
                    payload
                );

                await loadProjects(organizationId);

                return response;
            } catch (requestError) {
                dispatch(
                    setProjectError(getErrorMessage(requestError))
                );
                throw requestError;
            } finally {
                dispatch(setProjectSubmitting(false));
            }
        },
        [dispatch, loadProjects]
    );

    // -------------------------------------------------------------------------
    // Project Workflow: restoration
    // -------------------------------------------------------------------------

    const getProject = (projectId) =>
        executeWorkflowRequest(
            "restoreProject",
            () => projectApi.getProject(projectId),
            "Unable to load project."
        );

    const getIntegrationPreview = (integrationId) =>
        executeWorkflowRequest(
            "restoreIntegration",
            () => projectApi.getWorkflowIntegrationPreview(integrationId),
            "Unable to restore Integration Profile."
        );

    const getCredentials = (integrationId) =>
        executeWorkflowRequest(
            "restoreCredentials",
            () => projectApi.getWorkflowCredentials(integrationId),
            "Unable to restore credential metadata."
        );

    const getCountryRun = (projectId, runId) =>
        executeWorkflowRequest(
            "restoreCountryRun",
            () => projectApi.getWorkflowCountryRun(projectId, runId),
            "Unable to restore Country Intelligence run."
        );

    const getCountryProfile = (projectId, profileId) =>
        executeWorkflowRequest(
            "restoreCountryProfile",
            () =>
                projectApi.getWorkflowCountryProfile(
                    projectId,
                    profileId
                ),
            "Unable to restore country profile."
        );

    const getCapabilityRun = (runId) =>
        executeWorkflowRequest(
            "restoreCapabilityRun",
            () => projectApi.getWorkflowCapabilityRun(runId),
            "Unable to restore capability run."
        );

    const getAnalysisRun = (projectId, runId) =>
        executeWorkflowRequest(
            "restoreAnalysisRun",
            () => projectApi.getWorkflowAnalysisRun(projectId, runId),
            "Unable to restore AI Gap Analysis."
        );

    // -------------------------------------------------------------------------
    // Project Workflow: Integration Intelligence
    // -------------------------------------------------------------------------

    const uploadIntegration = (projectId, formData) =>
        executeWorkflowRequest(
            "uploadIntegration",
            () => projectApi.uploadWorkflowIntegration(projectId, formData),
            "Unable to upload and analyse integration source."
        );

    const updateIntegrationProfile = (integrationId, profile) =>
        executeWorkflowRequest(
            "updateIntegrationProfile",
            () =>
                projectApi.updateWorkflowIntegrationProfile(
                    integrationId,
                    profile
                ),
            "Unable to save Integration Profile."
        );

    const confirmIntegration = (integrationId) =>
        executeWorkflowRequest(
            "confirmIntegration",
            () => projectApi.confirmWorkflowIntegration(integrationId),
            "Unable to confirm Integration Profile."
        );

    // -------------------------------------------------------------------------
    // Project Workflow: Country Intelligence
    // -------------------------------------------------------------------------

    const startCountryIntelligence = (projectId) =>
        executeWorkflowRequest(
            "startCountryIntelligence",
            () =>
                projectApi.startWorkflowCountryIntelligence(projectId),
            "Unable to start Country Intelligence."
        );

    // -------------------------------------------------------------------------
    // Project Workflow: credentials
    // -------------------------------------------------------------------------

    const createCredentials = (integrationId, payload) =>
        executeWorkflowRequest(
            "createCredentials",
            () =>
                projectApi.createWorkflowCredentials(
                    integrationId,
                    payload
                ),
            "Unable to save Sandbox credentials."
        );

    const updateCredentials = (
        integrationId,
        credentialId,
        payload
    ) =>
        executeWorkflowRequest(
            "updateCredentials",
            () =>
                projectApi.updateWorkflowCredentials(
                    integrationId,
                    credentialId,
                    payload
                ),
            "Unable to update Sandbox credentials."
        );

    // -------------------------------------------------------------------------
    // Project Workflow: unified verification
    // -------------------------------------------------------------------------

    const startVerification = (credentialId, payload) =>
        executeWorkflowRequest(
            "startVerification",
            () =>
                projectApi.startWorkflowVerification(
                    credentialId,
                    payload
                ),
            "Provider Verification failed."
        );

    const resumeVerification = (capabilityRunId) =>
        executeWorkflowRequest(
            "resumeVerification",
            () =>
                projectApi.resumeWorkflowVerification(capabilityRunId),
            "Unable to resume Provider Verification."
        );

    // -------------------------------------------------------------------------
    // Project Workflow: AI Gap Analysis
    // -------------------------------------------------------------------------

    const startGapAnalysis = (projectId, payload) =>
        executeWorkflowRequest(
            "startGapAnalysis",
            () =>
                projectApi.startWorkflowGapAnalysis(projectId, payload),
            "AI Gap Analysis failed."
        );

    const refreshGapAnalysis = (projectId, runId) =>
        executeWorkflowRequest(
            "refreshGapAnalysis",
            () =>
                projectApi.refreshWorkflowGapAnalysis(
                    projectId,
                    runId
                ),
            "Unable to refresh AI Gap Analysis."
        );

    return {
        // Existing project state and methods
        projects,
        selectedProject,
        loading,
        submitting,
        error,
        loadProjects,
        loadProject,
        loadProjectOverview,
        create,

        // Workflow request state
        workflowRequests,
        workflowError,

        // Workflow methods
        getProject,
        getIntegrationPreview,
        getCredentials,
        getCountryRun,
        getCountryProfile,
        getCapabilityRun,
        getAnalysisRun,
        uploadIntegration,
        updateIntegrationProfile,
        confirmIntegration,
        startCountryIntelligence,
        createCredentials,
        updateCredentials,
        startVerification,
        resumeVerification,
        startGapAnalysis,
        refreshGapAnalysis,
    };
}
