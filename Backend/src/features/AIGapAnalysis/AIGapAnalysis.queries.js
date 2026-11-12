export const GET_PROJECT_AND_CAPABILITY_CONTEXT = `
  SELECT
    p.id AS project_id,
    p.organization_id,
    p.name AS project_name,
    p.provider AS project_provider,
    p.integration_type,
    p.assessment_objective,
    p.source_country,
    p.target_countries,

    i.id AS integration_id,
    i.source_id,
    i.integration_profile,
    i.review_status AS integration_review_status,
    i.created_at AS integration_created_at,
    i.updated_at AS integration_updated_at,

    s.original_filename AS source_filename,
    s.source_type,
    s.status AS source_status,

    cvr.id AS capability_run_id,
    cvr.provider AS capability_provider,
    cvr.environment,
    cvr.capability_code,
    cvr.overall_status,
    cvr.execution_status,
    cvr.started_at AS capability_started_at,
    cvr.completed_at AS capability_completed_at,
    cvr.credential_id,
    cvr.credential_version,
    cvr.execution_context,
    cvr.created_by AS capability_created_by

  FROM projects p
  INNER JOIN integrations i
    ON i.project_id = p.id
  INNER JOIN integration_sources s
    ON s.id = i.source_id
   AND s.project_id = p.id
  INNER JOIN capability_verification_runs cvr
    ON cvr.integration_id = i.id
  INNER JOIN organization_members om
    ON om.organization_id = p.organization_id
  WHERE p.id = $1
    AND cvr.id = $2
    AND om.user_id = $3
    AND om.role IN ('ADMIN', 'DEVELOPER')
  LIMIT 1;
`;

export const GET_CAPABILITY_CHECKS = `
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
  ORDER BY execution_order ASC NULLS LAST, created_at ASC, id ASC;
`;

export const GET_CAPABILITY_EVIDENCE = `
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
  ORDER BY observed_at ASC, created_at ASC, id ASC;
`;

export const GET_COMPLETED_COUNTRY_PROFILE = `
  SELECT
    cip.id AS intelligence_id,
    cip.run_id AS country_run_id,
    cip.project_id,
    cip.country_code,
    cip.country_name,
    cip.status,
    cip.overview,
    cip.requirement_count,
    cip.source_count,
    cip.researched_at
  FROM country_intelligence_profiles cip
  WHERE cip.project_id = $1
    AND cip.country_code = $2
    AND cip.status = 'COMPLETED'
  ORDER BY cip.researched_at DESC NULLS LAST, cip.created_at DESC
  LIMIT 1;
`;

export const GET_COUNTRY_REQUIREMENTS_WITH_SOURCES = `
  SELECT
    cr.id,
    cr.category,
    cr.title,
    cr.description,
    cr.applicability,
    cr.evidence_status,
    cr.confidence,
    cr.confidence_score,
    cr.limitations,
    COALESCE(
      jsonb_agg(
        DISTINCT jsonb_build_object(
          'id', cis.id,
          'sourceName', cis.source_name,
          'url', cis.source_url,
          'domain', cis.source_domain,
          'publishedAt', cis.published_at,
          'retrievedAt', cis.retrieved_at,
          'excerpt', cis.excerpt
        )
      ) FILTER (WHERE cis.id IS NOT NULL),
      '[]'::jsonb
    ) AS sources
  FROM country_requirements cr
  LEFT JOIN country_requirement_sources crs
    ON crs.requirement_id = cr.id
  LEFT JOIN country_intelligence_sources cis
    ON cis.id = crs.source_id
  WHERE cr.profile_id = $1
  GROUP BY cr.id
  ORDER BY cr.category ASC, cr.created_at ASC;
`;

export const GET_COUNTRY_PROFILE_SOURCES = `
  SELECT
    id,
    source_name,
    source_url,
    source_domain,
    published_at,
    retrieved_at,
    excerpt
  FROM country_intelligence_sources
  WHERE profile_id = $1
  ORDER BY source_name ASC;
`;

export const INSERT_GAP_ANALYSIS_RUN = `
  INSERT INTO ai_gap_analysis_runs (
    project_id,
    integration_id,
    capability_run_id,
    country_profile_ids,
    provider,
    environment,
    status,
    created_by,
    started_at
  )
  VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'RUNNING', $7, NOW())
  RETURNING id, status, created_at;
`;

export const COMPLETE_GAP_ANALYSIS_RUN = `
  UPDATE ai_gap_analysis_runs
  SET
    status = 'COMPLETED',
    model = $2,
    ai_request_id = $3,
    ai_usage = $4::jsonb,
    evidence_snapshot = $5::jsonb,
    report = $6::jsonb,
    completed_at = NOW(),
    updated_at = NOW(),
    error_code = NULL,
    error_message = NULL
  WHERE id = $1
  RETURNING *;
`;

export const FAIL_GAP_ANALYSIS_RUN = `
  UPDATE ai_gap_analysis_runs
  SET
    status = 'FAILED',
    error_code = $2,
    error_message = $3,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = $1
  RETURNING id, status, error_code, error_message, completed_at;
`;

export const GET_GAP_ANALYSIS_RUN_FOR_USER = `
  SELECT
    gar.*,
    p.name AS project_name
  FROM ai_gap_analysis_runs gar
  INNER JOIN projects p
    ON p.id = gar.project_id
  INNER JOIN organization_members om
    ON om.organization_id = p.organization_id
  WHERE gar.project_id = $1
    AND gar.id = $2
    AND om.user_id = $3
  LIMIT 1;
`;
