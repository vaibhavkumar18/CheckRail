
// --------------------------------------------------
// Verification History Queries
// --------------------------------------------------

export const GET_VERIFICATION_RUNS_FOR_INTEGRATION = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by
    FROM capability_verification_runs r
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE r.integration_id = $1
      AND om.user_id = $2
    ORDER BY r.created_at DESC;
`;

// --------------------------------------------------
// Verification Run Details
// --------------------------------------------------

export const GET_VERIFICATION_RUN_DETAILS = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by,
        COALESCE(progress.total, 0)::int AS total_operations,
        COALESCE(progress.completed, 0)::int AS completed_operations,
        CASE
            WHEN COALESCE(progress.total, 0) = 0 THEN 0
            ELSE ROUND(
                (progress.completed::numeric / progress.total) * 100
            )
        END::int AS progress_percent
    FROM capability_verification_runs r
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (
                WHERE c.status IN (
                    'PASSED',
                    'FAILED',
                    'BLOCKED',
                    'SKIPPED',
                    'UNSUPPORTED',
                    'UNKNOWN',
                    'NOT_RUN'
                )
            ) AS completed
        FROM capability_verification_checks c
        WHERE c.run_id = r.id
    ) progress ON TRUE
    WHERE r.id = $1
      AND om.user_id = $2
    LIMIT 1;
`;

// --------------------------------------------------
// Latest Verification Runs
// --------------------------------------------------

export const GET_LATEST_VERIFICATION_RUNS = `
    SELECT DISTINCT ON (
        r.provider,
        r.environment,
        r.capability_code
    )
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by
    FROM capability_verification_runs r
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE r.integration_id = $1
      AND om.user_id = $2
    ORDER BY
        r.provider,
        r.environment,
        r.capability_code,
        r.created_at DESC,
        r.id DESC;
`;

// --------------------------------------------------
// Checks By Run
// --------------------------------------------------

export const GET_VERIFICATION_CHECKS_BY_RUN = `
    SELECT
        id,
        run_id,
        operation,
        status,
        message,
        provider_status,
        resource_id,
        execution_order,
        started_at,
        completed_at,
        attempt_count,
        error_code,
        error_message,
        created_at
    FROM capability_verification_checks
    WHERE run_id = $1
    ORDER BY
        execution_order ASC NULLS LAST,
        created_at ASC,
        id ASC;
`;

// --------------------------------------------------
// Evidence By Run
// --------------------------------------------------

export const GET_VERIFICATION_EVIDENCE_BY_RUN = `
    SELECT
        id,
        run_id,
        check_id,
        evidence_type,
        operation,
        http_method,
        endpoint,
        http_status,
        resource_id,
        metadata,
        observed_at,
        created_at
    FROM capability_verification_evidence
    WHERE run_id = $1
    ORDER BY
        observed_at ASC,
        created_at ASC,
        id ASC;
`;

// --------------------------------------------------
// Insert Verification Run
// --------------------------------------------------

export const INSERT_VERIFICATION_RUN = `
    INSERT INTO capability_verification_runs (
        integration_id,
        provider,
        environment,
        capability_code,
        overall_status,
        execution_status,
        started_at,
        completed_at,
        created_by,
        verification_run_id,
        workflow_run_id,
        credential_id,
        credential_version,
        credential_payload_encrypted,
        credential_encryption_iv,
        credential_encryption_auth_tag,
        execution_context
    )
    VALUES (
        $1, $2, $3, $4, $5, 'RUNNING',
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16::jsonb
    )
    RETURNING *;
`;

// --------------------------------------------------
// Insert Verification Check
// --------------------------------------------------

export const INSERT_VERIFICATION_CHECK = `
    INSERT INTO capability_verification_checks (
        run_id,
        operation,
        status,
        message,
        provider_status,
        resource_id,
        execution_order,
        started_at,
        completed_at,
        attempt_count,
        error_code,
        error_message
    )
    VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
    )
    RETURNING *;
`;

// --------------------------------------------------
// Update Individual Verification Check
// --------------------------------------------------

export const UPDATE_VERIFICATION_CHECK = `
    UPDATE capability_verification_checks
    SET
        status = $3,
        message = $4,
        provider_status = $5,
        resource_id = COALESCE($6, resource_id),
        started_at = COALESCE($7, started_at),
        completed_at = COALESCE($8, completed_at),
        attempt_count = COALESCE($9, attempt_count),
        error_code = $10,
        error_message = $11
    WHERE run_id = $1
      AND operation = $2
    RETURNING *;
`;

// --------------------------------------------------
// Insert Verification Evidence
// --------------------------------------------------

export const INSERT_VERIFICATION_EVIDENCE = `
    INSERT INTO capability_verification_evidence (
        run_id,
        check_id,
        evidence_type,
        operation,
        http_method,
        endpoint,
        http_status,
        resource_id,
        metadata,
        observed_at
    )
    VALUES (
        $1,
        COALESCE(
            $2,
            (
                SELECT id
                FROM capability_verification_checks
                WHERE run_id = $1
                  AND operation = $4
                LIMIT 1
            )
        ),
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10
    )
    RETURNING *;
`;

// --------------------------------------------------
// Update Verification Run Execution State
// --------------------------------------------------

export const UPDATE_VERIFICATION_RUN_STATUS = `
    UPDATE capability_verification_runs
    SET
        overall_status = $2,
        execution_status = $3,
        completed_at = $4,
        execution_context = CASE
            WHEN $5::jsonb IS NULL
                THEN execution_context
            ELSE $5::jsonb
        END
    WHERE id = $1
    RETURNING *;
`;

// --------------------------------------------------
// Get Verification Run For Authorized User
// --------------------------------------------------

export const GET_VERIFICATION_RUN_FOR_USER = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by
    FROM capability_verification_runs r
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE r.id = $1
      AND om.user_id = $2
    LIMIT 1;
`;

// --------------------------------------------------
// Get Capability Run For Resume
// Internal use only. Includes encrypted credential
// snapshot and execution context.
// --------------------------------------------------


export const GET_CAPABILITY_RUN_FOR_RESUME = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_by,
        r.verification_run_id,
        r.credential_id,
        r.credential_version,
        pc.credential_version AS current_credential_version,
        r.credential_payload_encrypted,
        r.credential_encryption_iv,
        r.credential_encryption_auth_tag,
        r.execution_context
    FROM capability_verification_runs r
    INNER JOIN payment_credentials pc
        ON pc.id = r.credential_id
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE r.id = $1
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;


export const CLAIM_CAPABILITY_RUN_FOR_RESUME = `
    UPDATE capability_verification_runs r
    SET
        execution_status = 'RUNNING'
    FROM payment_credentials pc
    WHERE r.id = $1
      AND r.execution_status = 'AWAITING_APPROVAL'
      AND r.credential_id = pc.id
      AND r.credential_version = pc.credential_version
      AND EXISTS (
          SELECT 1
          FROM integrations i
          INNER JOIN projects p
              ON p.id = i.project_id
          INNER JOIN organization_members om
              ON om.organization_id = p.organization_id
          WHERE i.id = r.integration_id
            AND om.user_id = $2
            AND om.role IN ('ADMIN', 'DEVELOPER')
      )
    RETURNING r.*;
`;
// --------------------------------------------------
// Latest Verified Hyperwallet Recipient
// --------------------------------------------------

export const GET_LATEST_VERIFIED_HYPERWALLET_RECIPIENT = `
    SELECT
        c.resource_id AS recipient_token,
        c.completed_at AS recipient_created_at,
        r.id AS capability_run_id,
        r.integration_id
    FROM capability_verification_runs r
    INNER JOIN capability_verification_checks c
        ON c.run_id = r.id
    INNER JOIN integrations i
        ON i.id = r.integration_id
    INNER JOIN projects p
        ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE r.integration_id = $1
      AND r.provider = 'HYPERWALLET'
      AND r.environment = 'SANDBOX'
      AND r.capability_code = 'RECIPIENT_MANAGEMENT'
      AND r.overall_status = 'VERIFIED'
      AND r.execution_status = 'COMPLETED'
      AND c.operation = 'CREATE_RECIPIENT'
      AND c.status = 'PASSED'
      AND c.resource_id IS NOT NULL
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    ORDER BY
        r.completed_at DESC NULLS LAST,
        r.created_at DESC
    LIMIT 1;
`;

// --------------------------------------------------
// Project-scoped Capability Verification History
// --------------------------------------------------

export const GET_VERIFICATION_RUNS_FOR_PROJECT = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by
    FROM capability_verification_runs r
    INNER JOIN integrations i ON i.id = r.integration_id
    INNER JOIN projects p ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE p.id = $1
      AND om.user_id = $2
    ORDER BY r.created_at DESC, r.id DESC;
`;

export const GET_LATEST_VERIFICATION_RUNS_FOR_PROJECT = `
    SELECT DISTINCT ON (r.provider, r.environment, r.capability_code)
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,
        r.created_by
    FROM capability_verification_runs r
    INNER JOIN integrations i ON i.id = r.integration_id
    INNER JOIN projects p ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE p.id = $1
      AND om.user_id = $2
    ORDER BY
        r.provider,
        r.environment,
        r.capability_code,
        r.created_at DESC,
        r.id DESC;
`;
// --------------------------------------------------
// All Verification Runs Accessible to User
// --------------------------------------------------

export const GET_VERIFICATION_RUNS_FOR_USER = `
    SELECT
        r.id,
        r.integration_id,
        r.provider,
        r.environment,
        r.capability_code,
        r.overall_status,
        r.execution_status,
        r.started_at,
        r.completed_at,
        r.created_at,

        p.id AS project_id,
        p.name AS project_name,
        p.provider AS project_provider,

        s.original_filename

    FROM capability_verification_runs r

    INNER JOIN integrations i
        ON i.id = r.integration_id

    INNER JOIN projects p
        ON p.id = i.project_id

    LEFT JOIN integration_sources s
        ON s.id = i.source_id

    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id

    WHERE om.user_id = $1

    ORDER BY
        r.created_at DESC,
        r.id DESC;
`;