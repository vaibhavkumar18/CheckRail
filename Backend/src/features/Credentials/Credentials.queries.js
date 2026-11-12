// ============================================
// Credentials Queries
// ============================================

export const INSERT_CREDENTIALS = `
    INSERT INTO payment_credentials (
        integration_id,
        provider,
        environment,
        client_id,
        client_secret_encrypted,
        credentials_encrypted,
        encryption_iv,
        encryption_auth_tag,
        webhook_id,
        created_by,
        updated_by
    )
    SELECT
        i.id,
        $2,
        $3,
        NULL,
        NULL,
        $4,
        $5,
        $6,
        NULL,
        $7,
        $7
    FROM integrations i
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE i.id = $1
      AND om.user_id = $7
      AND om.role IN ('ADMIN', 'DEVELOPER')
    RETURNING
        id,
        integration_id,
        provider,
        environment,
        credential_version,
        created_by,
        updated_by,
        created_at,
        updated_at;
`;

export const GET_CREDENTIALS_FOR_USER = `
    SELECT
        pc.id,
        pc.integration_id,
        pc.provider,
        pc.environment,
        pc.credential_version,
        pc.created_by,
        pc.updated_by,
        pc.created_at,
        pc.updated_at
    FROM payment_credentials pc
    INNER JOIN integrations i
        ON i.id = pc.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE pc.integration_id = $1
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    ORDER BY pc.created_at DESC;
`;

export const GET_CREDENTIALS_FOR_VERIFICATION = `
    SELECT
        pc.id,
        pc.integration_id,
        pc.provider,
        pc.environment,
        pc.credential_version,

        pc.credentials_encrypted,

        pc.client_id,
        pc.client_secret_encrypted,
        pc.webhook_id,

        pc.encryption_iv,
        pc.encryption_auth_tag

    FROM payment_credentials pc
    INNER JOIN integrations i
        ON i.id = pc.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE pc.integration_id = $1
      AND pc.provider = $2
      AND pc.environment = $3
      AND om.user_id = $4
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;

export const GET_PROVIDER_FOR_INTEGRATION = `
    SELECT
        i.id AS integration_id,
        p.provider
    FROM integrations i
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE i.id = $1
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;

export const GET_CREDENTIAL_BY_ID_FOR_WORKFLOW = `
    SELECT
        pc.id,
        pc.integration_id,
        pc.provider,
        pc.environment,
        pc.credential_version,

        pc.credentials_encrypted,

        pc.client_id,
        pc.client_secret_encrypted,
        pc.webhook_id,

        pc.encryption_iv,
        pc.encryption_auth_tag

    FROM payment_credentials pc
    INNER JOIN integrations i
        ON i.id = pc.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE pc.id = $1
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;

export const UPDATE_CREDENTIALS = `
    UPDATE payment_credentials pc
    SET
        client_id = NULL,
        client_secret_encrypted = NULL,
        credentials_encrypted = $5,
        encryption_iv = $6,
        encryption_auth_tag = $7,
        webhook_id = NULL,
        credential_version = pc.credential_version + 1,
        updated_by = $8,
        updated_at = NOW()
    FROM integrations i
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE pc.id = $1
      AND pc.integration_id = $2
      AND i.id = pc.integration_id
      AND om.user_id = $3
      AND pc.provider = $4
      AND om.role IN ('ADMIN', 'DEVELOPER')
    RETURNING
        pc.id,
        pc.integration_id,
        pc.provider,
        pc.environment,
        pc.credential_version,
        pc.created_by,
        pc.updated_by,
        pc.created_at,
        pc.updated_at;
`;

export const LOCK_CREDENTIAL_FOR_UPDATE = `
    SELECT pc.id
    FROM payment_credentials pc
    INNER JOIN integrations i
        ON i.id = pc.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE pc.id = $1
      AND pc.integration_id = $2
      AND om.user_id = $3
      AND pc.provider = $4
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1
    FOR UPDATE OF pc;
`;

export const DELETE_CREDENTIALS = `
    DELETE FROM payment_credentials pc
    USING integrations i,
          projects p,
          organization_members om
    WHERE pc.id = $1
      AND pc.integration_id = $2
      AND pc.integration_id = i.id
      AND i.project_id = p.id
      AND p.organization_id = om.organization_id
      AND om.user_id = $3
      AND om.role IN ('ADMIN', 'DEVELOPER')
    RETURNING
        pc.id,
        pc.integration_id,
        pc.provider,
        pc.environment;
`;