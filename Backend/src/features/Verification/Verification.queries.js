
export const LOCK_CREDENTIAL_FOR_VERIFICATION = `
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
        pc.encryption_auth_tag,

        p.id AS project_id,
        p.target_countries AS project_target_countries,
        p.source_country AS project_source_country,
        p.assessment_objective AS project_assessment_objective

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
    LIMIT 1
    FOR UPDATE OF pc;
`;

export const LOCK_CREDENTIAL_BY_ID_FOR_VERIFICATION = `
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
        pc.encryption_auth_tag,

        p.id AS project_id,
        p.target_countries AS project_target_countries,
        p.source_country AS project_source_country,
        p.assessment_objective AS project_assessment_objective

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
    LIMIT 1
    FOR UPDATE OF pc;
`;

export const INSERT_VERIFICATION_RUN = `
    INSERT INTO verification_runs (
        integration_id,
        provider,
        environment,
        status,
        current_stage,
        progress_percent,
        started_at,
        created_by
    )
    VALUES ($1, $2, $3, 'RUNNING', 'CREDENTIAL_VERIFICATION', 10, $4, $5)
    RETURNING id;
`;

export const INSERT_CREDENTIAL_VERIFICATION_RESULT = `
    INSERT INTO credential_verification_results (
        verification_run_id,
        credential_id,
        credential_version,
        status,
        authentication_status,
        started_at
    )
    VALUES ($1, $2, $3, 'RUNNING', 'NOT_RUN', $4)
    RETURNING id;
`;

export const GET_STALE_CREDENTIAL_VERIFICATION = `
    SELECT
        vr.id AS run_id,
        cvr.id AS result_id
    FROM verification_runs vr
    INNER JOIN credential_verification_results cvr
        ON cvr.verification_run_id = vr.id
    WHERE cvr.credential_id = $1
      AND cvr.credential_version = $2
      AND vr.status = 'RUNNING'
      AND vr.current_stage = 'CREDENTIAL_VERIFICATION'
      AND vr.started_at < NOW() - INTERVAL '60 seconds'
    FOR UPDATE OF vr, cvr;
`;

export const UPDATE_STALE_CREDENTIAL_VERIFICATION_RESULT = `
    UPDATE credential_verification_results
    SET
        status = 'FAILED',
        authentication_status = 'NOT_RUN',
        message = 'Credential verification exceeded its execution window.',
        error_code = 'VERIFICATION_EXECUTION_TIMEOUT',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
      AND status = 'RUNNING'
    RETURNING *;
`;

export const UPDATE_STALE_VERIFICATION_RUN = `
    UPDATE verification_runs
    SET
        status = 'FAILED',
        current_stage = 'COMPLETED',
        progress_percent = 100,
        error_code = 'VERIFICATION_EXECUTION_TIMEOUT',
        error_message = 'Credential verification exceeded its execution window.',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
      AND status = 'RUNNING'
      AND current_stage = 'CREDENTIAL_VERIFICATION'
    RETURNING *;
`;

export const GET_ACTIVE_CREDENTIAL_VERIFICATION = `
    SELECT vr.id
    FROM verification_runs vr
    INNER JOIN credential_verification_results cvr
        ON cvr.verification_run_id = vr.id
    WHERE cvr.credential_id = $1
      AND cvr.credential_version = $2
      AND vr.status = 'RUNNING'
      AND (
          vr.current_stage <> 'CREDENTIAL_VERIFICATION'
          OR vr.started_at >= NOW() - INTERVAL '60 seconds'
      )
    LIMIT 1;
`;

export const UPDATE_VERIFICATION_RUN_STAGE = `
    UPDATE verification_runs
    SET
        current_stage = $2,
        updated_at = NOW()
    WHERE id = $1
      AND status = 'RUNNING'
    RETURNING *;
`;

export const LOCK_CREDENTIAL_FOR_RESULT = `
    SELECT
        id,
        credential_version
    FROM payment_credentials
    WHERE id = $1
    FOR UPDATE;
`;

export const UPDATE_CREDENTIAL_VERIFICATION_RESULT = `
    UPDATE credential_verification_results
    SET
        status = $2,
        authentication_status = $3,
        provider_status = $4,
        message = $5,
        error_code = $6,
        evidence = $7::jsonb,
        completed_at = $8,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
`;

export const UPDATE_VERIFICATION_RUN = `
    UPDATE verification_runs
    SET
        status = $2,
        current_stage = 'COMPLETED',
        progress_percent = 100,
        completed_at = $3,
        error_code = $4,
        error_message = $5,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
`;
