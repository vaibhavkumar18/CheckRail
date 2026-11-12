import DB from "../../config/DB.js";

import {
    INSERT_CREDENTIALS,
    GET_CREDENTIALS_FOR_USER,
    GET_CREDENTIALS_FOR_VERIFICATION,
    GET_PROVIDER_FOR_INTEGRATION,
    GET_CREDENTIAL_BY_ID_FOR_WORKFLOW,
    UPDATE_CREDENTIALS,
    LOCK_CREDENTIAL_FOR_UPDATE,
    DELETE_CREDENTIALS,
} from "./Credentials.queries.js";

const withTransaction = async (callback) => {
    const client = await DB.connect();

    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// --------------------------------------------------
// Create Credentials
// --------------------------------------------------

export const createCredentials = async ({
    integrationId,
    provider,
    environment,
    encryptedPayload,
    iv,
    authTag,
    userId,
}) => {
    const result = await DB.query(
        INSERT_CREDENTIALS,
        [
            integrationId,
            provider,
            environment,
            encryptedPayload,
            iv,
            authTag,
            userId,
        ]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Get Safe Metadata
// --------------------------------------------------

export const getCredentialsForUser = async (
    integrationId,
    userId
) => {
    const result = await DB.query(
        GET_CREDENTIALS_FOR_USER,
        [integrationId, userId]
    );

    return result.rows;
};

// --------------------------------------------------
// Get Credentials for Provider Verification
// --------------------------------------------------

export const getCredentialsForVerification = async ({
    integrationId,
    provider,
    environment,
    userId,
}) => {
    const result = await DB.query(
        GET_CREDENTIALS_FOR_VERIFICATION,
        [
            integrationId,
            provider,
            environment,
            userId,
        ]
    );

    return result.rows[0] ?? null;
};

export const getProviderForIntegration = async ({
    integrationId,
    userId,
}) => {
    const result = await DB.query(
        GET_PROVIDER_FOR_INTEGRATION,
        [integrationId, userId],
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Get Credential by ID for Workflow Snapshot
// --------------------------------------------------

export const getCredentialByIdForWorkflow = async ({
    credentialId,
    userId,
}) => {
    const result = await DB.query(
        GET_CREDENTIAL_BY_ID_FOR_WORKFLOW,
        [
            credentialId,
            userId,
        ]
    );

    return result.rows[0] ?? null;
};

// --------------------------------------------------
// Update Credentials
// --------------------------------------------------

export const updateCredentials = async ({
    credentialId,
    integrationId,
    userId,
    provider,
    encryptedPayload,
    iv,
    authTag,
}) => {
    return withTransaction(async (client) => {
        const lockResult = await client.query(
            LOCK_CREDENTIAL_FOR_UPDATE,
            [credentialId, integrationId, userId, provider],
        );

        if (!lockResult.rows[0]) {
            return null;
        }

        const result = await client.query(
            UPDATE_CREDENTIALS,
            [
                credentialId,
                integrationId,
                userId,
                provider,
                encryptedPayload,
                iv,
                authTag,
                userId,
            ],
        );

        return result.rows[0] ?? null;
    });
};

// --------------------------------------------------
// Delete Credentials
// --------------------------------------------------

export const deleteCredentials = async ({
    credentialId,
    integrationId,
    userId,
}) => {
    const result = await DB.query(
        DELETE_CREDENTIALS,
        [
            credentialId,
            integrationId,
            userId,
        ]
    );

    return result.rows[0] ?? null;
};