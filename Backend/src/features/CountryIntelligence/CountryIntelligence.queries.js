
export const GET_AUTHORIZED_PROJECT_CONTEXT = `
  SELECT
    p.id,
    p.name,
    p.organization_id AS "organizationId",
    p.assessment_objective AS "assessmentObjective",
    p.source_country AS "sourceCountry",
    p.target_countries AS "targetCountries"
  FROM projects p
  INNER JOIN organization_members om
    ON om.organization_id = p.organization_id
   AND om.user_id = $2
  WHERE p.id = $1
  LIMIT 1
`;

export const GET_ACTIVE_RUN = `
  SELECT
    id,
    status,
    total_countries AS "totalCountries",
    created_at AS "createdAt"
  FROM country_intelligence_runs
  WHERE project_id = $1
    AND status IN ('QUEUED', 'RUNNING')
  LIMIT 1
`;

export const GET_RUN_BY_ID = `
  SELECT
    id,
    project_id AS "projectId",
    status,
    total_countries AS "totalCountries",
    completed_countries AS "completedCountries",
    failed_countries AS "failedCountries",
    error_summary AS "errorSummary",
    started_at AS "startedAt",
    completed_at AS "completedAt",
    created_at AS "createdAt"
  FROM country_intelligence_runs
  WHERE id = $1
    AND project_id = $2
  LIMIT 1
`;

export const GET_RUN_COUNTRIES = `
  SELECT
    id AS "intelligenceId",
    country_code AS "countryCode",
    country_name AS "countryName",
    status,
    requirement_count AS "requirementCount",
    source_count AS "sourceCount",
    error_summary AS "errorSummary",
    researched_at AS "researchedAt"
  FROM country_intelligence_profiles
  WHERE run_id = $1
  ORDER BY country_name ASC
`;

export const GET_LATEST_COUNTRY_PROFILES = `
  SELECT DISTINCT ON (cip.country_code)
    cip.id AS "intelligenceId",
    cir.id AS "runId",
    cip.country_code AS "countryCode",
    cip.country_name AS "countryName",
    cip.status,
    cip.requirement_count AS "requirementCount",
    cip.source_count AS "sourceCount",
    cip.researched_at AS "lastResearchedAt",
    cir.created_at AS "runCreatedAt"
  FROM country_intelligence_profiles cip
  INNER JOIN country_intelligence_runs cir
    ON cir.id = cip.run_id
  WHERE cip.project_id = $1
  ORDER BY
    cip.country_code ASC,
    cir.created_at DESC,
    cip.created_at DESC
`;

export const GET_COUNTRY_PROFILE_BY_ID = `
  SELECT
    cip.id AS "intelligenceId",
    cip.project_id AS "projectId",
    cip.run_id AS "runId",
    cip.country_code AS "countryCode",
    cip.country_name AS "countryName",
    cip.status,
    cip.overview,
    cip.requirement_count AS "requirementCount",
    cip.source_count AS "sourceCount",
    cip.researched_at AS "lastResearchedAt",
    cir.created_at AS "runCreatedAt"
  FROM country_intelligence_profiles cip
  INNER JOIN country_intelligence_runs cir
    ON cir.id = cip.run_id
  WHERE cip.project_id = $1
    AND cip.id = $2
  LIMIT 1
`;

export const GET_PROFILE_REQUIREMENTS = `
  SELECT
    cr.id,
    cr.category,
    cr.title,
    cr.description,
    cr.applicability,
    cr.evidence_status AS "evidenceStatus",
    cr.confidence,
    cr.confidence_score AS "confidenceScore",
    cr.limitations,
    cr.created_at AS "createdAt"
  FROM country_requirements cr
  WHERE cr.profile_id = $1
  ORDER BY cr.category ASC, cr.created_at ASC
`;

export const GET_PROFILE_SOURCES = `
  SELECT
    id,
    source_name AS "sourceName",
    source_url AS url,
    source_domain AS domain,
    published_at AS "publishedAt",
    retrieved_at AS "retrievedAt",
    excerpt
  FROM country_intelligence_sources
  WHERE profile_id = $1
  ORDER BY source_name ASC
`;

export const GET_REQUIREMENT_SOURCE_LINKS = `
  SELECT
    requirement_id AS "requirementId",
    source_id AS "sourceId"
  FROM country_requirement_sources
  WHERE requirement_id = ANY($1::uuid[])
`;
