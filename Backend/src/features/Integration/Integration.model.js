
import DB from "../../config/DB.js";

import {
    CHECK_PROJECT_ACCESS,
    INSERT_INTEGRATION_SOURCE,
    GET_INTEGRATION_SOURCE_BY_ID,
    GET_INTEGRATION_SOURCES_BY_PROJECT,
    GET_INTEGRATION_SOURCE_FOR_USER,
    GET_INTEGRATION_SOURCE_FOR_PROCESSING,
    UPDATE_INTEGRATION_SOURCE_STATUS,
    INSERT_INTEGRATION,
    GET_INTEGRATION_FOR_USER,
    GET_INTEGRATIONS_FOR_PROJECT,
    UPDATE_INTEGRATION_PROFILE,
    CONFIRM_INTEGRATION,
    GET_ALL_INTEGRATIONS_FOR_USER,
} from "./Integration.queries.js";

// --------------------------------------------------
// Project Access
// --------------------------------------------------

export const checkProjectAccess = async (projectId, userId) => {
    const result = await DB.query(
        CHECK_PROJECT_ACCESS,
        [projectId, userId]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Integration Source
// --------------------------------------------------

export const createIntegrationSource = async (source) => {
    const values = [
        source.projectId,
        source.originalFilename,
        source.sourceType,
        source.mimeType,
        source.fileSize,
        source.sha256,
        source.storageProvider,
        source.storageAssetId,
        source.storagePublicId,
        source.resourceType,
        source.deliveryType,
        source.uploadedBy,
    ];

    const result = await DB.query(
        INSERT_INTEGRATION_SOURCE,
        values
    );

    return result.rows[0];
};

export const getIntegrationSourceById = async (sourceId) => {
    const result = await DB.query(
        GET_INTEGRATION_SOURCE_BY_ID,
        [sourceId]
    );

    return result.rows[0] ?? null;
};

export const getIntegrationSourcesByProject = async (projectId) => {
    const result = await DB.query(
        GET_INTEGRATION_SOURCES_BY_PROJECT,
        [projectId]
    );

    return result.rows;
};

export const getIntegrationSourceForUser = async (
    sourceId,
    userId,
) => {
    const result = await DB.query(
        GET_INTEGRATION_SOURCE_FOR_USER,
        [sourceId, userId]
    );

    return result.rows[0] ?? null;
};

export const getIntegrationSourceForProcessing = async (
    sourceId,
    projectId,
    userId,
) => {
    const result = await DB.query(
        GET_INTEGRATION_SOURCE_FOR_PROCESSING,
        [sourceId, projectId, userId]
    );

    return result.rows[0] ?? null;
};

export const updateIntegrationSourceStatus = async (
    sourceId,
    status,
) => {
    const result = await DB.query(
        UPDATE_INTEGRATION_SOURCE_STATUS,
        [sourceId, status]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Integration Profile
// --------------------------------------------------

export const createIntegration = async ({
    sourceId,
    projectId,
    profile,
}) => {
    const result = await DB.query(
        INSERT_INTEGRATION,
        [
            sourceId,
            projectId,
            JSON.stringify(profile),
        ]
    );

    return result.rows[0];
};

// --------------------------------------------------
// Get One Integration For Authorized User
// --------------------------------------------------

export const getIntegrationForUser = async (
    integrationId,
    userId,
) => {
    const result = await DB.query(
        GET_INTEGRATION_FOR_USER,
        [integrationId, userId]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Update Integration Profile
// --------------------------------------------------

export const updateIntegrationProfile = async ({
    integrationId,
    userId,
    profile,
}) => {
    const result = await DB.query(
        UPDATE_INTEGRATION_PROFILE,
        [
            integrationId,
            userId,
            JSON.stringify(profile),
        ]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Confirm Integration
// --------------------------------------------------

export const confirmIntegration = async ({
    integrationId,
    userId,
}) => {
    const result = await DB.query(
        CONFIRM_INTEGRATION,
        [
            integrationId,
            userId,
            userId,
        ]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Integration Profiles By Project
// --------------------------------------------------

export const getIntegrationsForProject = async (
    projectId,
    userId
) => {
    const result = await DB.query(
        GET_INTEGRATIONS_FOR_PROJECT,
        [projectId, userId]
    );

    return result.rows;
};
// --------------------------------------------------
// All Integration Profiles Accessible To User
// --------------------------------------------------

export const getAllIntegrationsForUser = async (userId) => {
    const result = await DB.query(
        GET_ALL_INTEGRATIONS_FOR_USER,
        [userId]
    );

    return result.rows;
};