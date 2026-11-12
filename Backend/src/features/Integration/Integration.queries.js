export const CHECK_PROJECT_ACCESS = `
    SELECT
        p.id AS project_id,
        p.organization_id
    FROM projects p
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE p.id = $1
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;

export const INSERT_INTEGRATION_SOURCE = `
    INSERT INTO integration_sources (
        project_id,
        original_filename,
        source_type,
        mime_type,
        file_size,
        sha256,
        storage_provider,
        storage_asset_id,
        storage_public_id,
        resource_type,
        delivery_type,
        uploaded_by
    )
    VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12
    )
    RETURNING *;
`;

export const GET_INTEGRATION_SOURCE_BY_ID = `
    SELECT *
    FROM integration_sources
    WHERE id = $1
    LIMIT 1;
`;

export const GET_INTEGRATION_SOURCES_BY_PROJECT = `
    SELECT *
    FROM integration_sources
    WHERE project_id = $1
    ORDER BY created_at DESC;
`;

export const GET_INTEGRATION_SOURCE_FOR_USER = `
    SELECT s.*
    FROM integration_sources s
    INNER JOIN projects p
        ON p.id = s.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE s.id = $1
      AND om.user_id = $2
    LIMIT 1;
`;

export const GET_INTEGRATION_SOURCE_FOR_PROCESSING = `
    SELECT s.*
    FROM integration_sources s
    INNER JOIN projects p
        ON p.id = s.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE s.id = $1
      AND p.id = $2
      AND om.user_id = $3
      AND om.role IN ('ADMIN', 'DEVELOPER')
    LIMIT 1;
`;

export const UPDATE_INTEGRATION_SOURCE_STATUS = `
    UPDATE integration_sources
    SET
        status = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *;
`;

// --------------------------------------------------
// Integration Profile Queries
// --------------------------------------------------

export const INSERT_INTEGRATION = `
    INSERT INTO integrations (
        source_id,
        project_id,
        original_profile,
        integration_profile
    )
    VALUES ($1, $2, $3::jsonb, $3::jsonb)
    RETURNING *;
`;


export const GET_INTEGRATION_FOR_USER = `
    SELECT
        i.*,
        s.original_filename,
        s.source_type,
        s.status AS source_status,

        p.name AS project_name,
        p.provider AS project_provider,
        p.integration_type AS project_integration_type,
        p.assessment_objective AS project_assessment_objective,
        p.source_country AS project_source_country,
        p.target_countries AS project_target_countries

    FROM integrations i

    INNER JOIN integration_sources s
        ON s.id = i.source_id

    INNER JOIN projects p
        ON p.id = i.project_id

    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id

    WHERE i.id = $1
      AND om.user_id = $2

    LIMIT 1;
`;


export const UPDATE_INTEGRATION_PROFILE = `
    UPDATE integrations i
    SET
        integration_profile = $3::jsonb,
        updated_at = NOW()
    FROM projects p
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE i.id = $1
      AND i.project_id = p.id
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
      AND i.review_status = 'PENDING'
    RETURNING i.*;
`;

export const CONFIRM_INTEGRATION = `
    UPDATE integrations i
    SET
        review_status = 'CONFIRMED',
        confirmed_by = $3,
        confirmed_at = NOW(),
        updated_at = NOW()
    FROM projects p
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE i.id = $1
      AND i.project_id = p.id
      AND om.user_id = $2
      AND om.role IN ('ADMIN', 'DEVELOPER')
      AND i.review_status = 'PENDING'
    RETURNING i.*;
`;

// --------------------------------------------------
// List Integration Profiles For A Project
// --------------------------------------------------

export const GET_INTEGRATIONS_FOR_PROJECT = `
    SELECT
        i.id,
        i.source_id,
        i.review_status,
        i.created_at,
        i.updated_at,
        s.original_filename,
        s.source_type,
        s.status AS source_status
    FROM integrations i
    INNER JOIN integration_sources s ON s.id = i.source_id
    INNER JOIN projects p ON p.id = i.project_id
    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id
    WHERE p.id = $1
      AND om.user_id = $2
    ORDER BY i.created_at DESC, i.id DESC;
`;

// --------------------------------------------------
// List All Integration Profiles Accessible To User
// --------------------------------------------------

export const GET_ALL_INTEGRATIONS_FOR_USER = `
    SELECT DISTINCT
        i.id,
        i.source_id,
        i.review_status,
        i.created_at,
        i.updated_at,

        s.original_filename,
        s.source_type,
        s.status AS source_status,

        p.id AS project_id,
        p.name AS project_name,
        p.provider AS project_provider,
        p.integration_type AS project_integration_type,
        p.source_country AS project_source_country,
        p.target_countries AS project_target_countries

    FROM integrations i

    INNER JOIN integration_sources s
        ON s.id = i.source_id

    INNER JOIN projects p
        ON p.id = i.project_id

    INNER JOIN organization_members om
        ON om.organization_id = p.organization_id

    WHERE om.user_id = $1

    ORDER BY i.created_at DESC, i.id DESC;
`;