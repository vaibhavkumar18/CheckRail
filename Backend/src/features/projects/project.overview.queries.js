
export const GET_PROJECT_OVERVIEW = `
  SELECT
    p.id AS project_id,
    p.organization_id,
    p.name AS project_name,
    p.provider,
    p.source_country,
    p.target_countries,
    p.integration_type,
    p.created_at,
    p.updated_at,

    i.id AS integration_id,
    i.review_status AS integration_review_status,
    i.created_at AS integration_created_at,
    i.updated_at AS integration_updated_at,

    cvr.id AS capability_run_id,
    cvr.overall_status AS capability_overall_status,
    cvr.execution_status AS capability_execution_status,
    cvr.started_at AS capability_started_at,
    cvr.completed_at AS capability_completed_at,

    cip.id AS country_intelligence_id,
    cip.status AS country_intelligence_status,
    cip.country_code AS country_intelligence_country_code,
    cip.researched_at AS country_intelligence_researched_at,

    gar.id AS gap_analysis_run_id,
    gar.status AS gap_analysis_status,
    gar.created_at AS gap_analysis_created_at,
    gar.completed_at AS gap_analysis_completed_at

  FROM projects p

  INNER JOIN organization_members om
    ON om.organization_id = p.organization_id
   AND om.user_id = $2

  LEFT JOIN LATERAL (
    SELECT
      id,
      review_status,
      created_at,
      updated_at
    FROM integrations
    WHERE project_id = p.id
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  ) i ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      id,
      overall_status,
      execution_status,
      started_at,
      completed_at
    FROM capability_verification_runs
    WHERE integration_id = i.id
    ORDER BY created_at DESC
    LIMIT 1
  ) cvr ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      id,
      status,
      country_code,
      researched_at
    FROM country_intelligence_profiles
    WHERE project_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) cip ON TRUE

  LEFT JOIN LATERAL (
    SELECT
      id,
      status,
      created_at,
      completed_at
    FROM ai_gap_analysis_runs
    WHERE project_id = p.id
    ORDER BY created_at DESC
    LIMIT 1
  ) gar ON TRUE

  WHERE p.id = $1
  LIMIT 1;
`;
