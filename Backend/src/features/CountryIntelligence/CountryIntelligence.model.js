
import DB from "../../config/DB.js";
import * as Q from "./CountryIntelligence.queries.js";

export const getAuthorizedProjectContext = async (
  projectId,
  userId,
) => {
  const { rows } = await DB.query(
    Q.GET_AUTHORIZED_PROJECT_CONTEXT,
    [projectId, userId],
  );

  return rows[0] ?? null;
};

export const getActiveRun = async (projectId) => {
  const { rows } = await DB.query(
    Q.GET_ACTIVE_RUN,
    [projectId],
  );

  return rows[0] ?? null;
};

export const createResearchRun = async ({
  projectId,
  userId,
  countries,
}) => {
  const client = await DB.connect();

  try {
    await client.query("BEGIN");

    // Serialize run creation per project.
    const projectResult = await client.query(
      "SELECT id FROM projects WHERE id = $1 FOR UPDATE",
      [projectId],
    );

    if (!projectResult.rows[0]) {
      throw Object.assign(
        new Error("Project not found."),
        { statusCode: 404 },
      );
    }

    const activeResult = await client.query(
      Q.GET_ACTIVE_RUN,
      [projectId],
    );

    if (activeResult.rows[0]) {
      await client.query("COMMIT");

      return {
        existing: true,
        run: activeResult.rows[0],
      };
    }

    const runResult = await client.query(
      `INSERT INTO country_intelligence_runs
        (
          project_id,
          created_by,
          status,
          target_countries,
          total_countries
        )
       VALUES ($1, $2, 'QUEUED', $3::jsonb, $4)
       RETURNING
         id,
         status,
         total_countries AS "totalCountries",
         created_at AS "createdAt"`,
      [
        projectId,
        userId,
        JSON.stringify(countries),
        countries.length,
      ],
    );

    const run = runResult.rows[0];

    for (const country of countries) {
      await client.query(
        `INSERT INTO country_intelligence_profiles
          (
            run_id,
            project_id,
            country_code,
            country_name,
            status
          )
         VALUES ($1, $2, $3, $4, 'QUEUED')`,
        [
          run.id,
          projectId,
          country.code,
          country.name,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      existing: false,
      run,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const markRunStarted = async (runId) => {
  await DB.query(
    `UPDATE country_intelligence_runs
     SET
       status = 'RUNNING',
       started_at = COALESCE(started_at, NOW()),
       updated_at = NOW()
     WHERE id = $1
       AND status = 'QUEUED'`,
    [runId],
  );
};

export const markProfileStarted = async (profileId) => {
  await DB.query(
    `UPDATE country_intelligence_profiles
     SET status = 'RUNNING',
         updated_at = NOW()
     WHERE id = $1`,
    [profileId],
  );
};

export const getRunProfilesForExecution = async (runId) => {
  const { rows } = await DB.query(
    `SELECT
       id,
       country_code AS "countryCode",
       country_name AS "countryName"
     FROM country_intelligence_profiles
     WHERE run_id = $1
     ORDER BY country_code`,
    [runId],
  );

  return rows;
};

export const saveCountryResearch = async ({
  profileId,
  overview,
  sources,
  requirements,
}) => {
  const client = await DB.connect();

  try {
    await client.query("BEGIN");

    const sourceIdByKey = new Map();

    for (const source of sources) {
      const result = await client.query(
        `INSERT INTO country_intelligence_sources
          (
            profile_id,
            source_key,
            source_name,
            source_url,
            source_domain,
            published_at,
            excerpt,
            source_score
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (profile_id, source_url)
         DO UPDATE SET
           source_name = EXCLUDED.source_name,
           source_domain = EXCLUDED.source_domain,
           published_at = EXCLUDED.published_at,
           excerpt = EXCLUDED.excerpt
         RETURNING
           id,
           source_key AS "sourceKey"`,
        [
          profileId,
          source.sourceKey,
          source.sourceName,
          source.url,
          source.domain,
          source.publishedAt,
          source.excerpt,
          source.score,
        ],
      );

      sourceIdByKey.set(
        source.sourceKey,
        result.rows[0].id,
      );
    }

    for (const requirement of requirements) {
      const result = await client.query(
        `INSERT INTO country_requirements
          (
            profile_id,
            category,
            title,
            description,
            applicability,
            evidence_status,
            confidence,
            confidence_score,
            limitations
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id`,
        [
          profileId,
          requirement.category,
          requirement.title,
          requirement.description,
          requirement.applicability,
          requirement.evidenceStatus,
          requirement.confidence,
          requirement.confidenceScore,
          JSON.stringify(requirement.limitations ?? []),
        ],
      );

      const requirementId = result.rows[0].id;

      for (const sourceKey of requirement.evidenceIds) {
        const sourceId = sourceIdByKey.get(sourceKey);

        if (!sourceId) continue;

        await client.query(
          `INSERT INTO country_requirement_sources
            (requirement_id, source_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [requirementId, sourceId],
        );
      }
    }

    await client.query(
      `UPDATE country_intelligence_profiles
       SET
         status = 'COMPLETED',
         overview = $2::jsonb,
         requirement_count = $3,
         source_count = $4,
         researched_at = NOW(),
         error_summary = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [
        profileId,
        JSON.stringify(overview),
        requirements.length,
        sources.length,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const markProfileFailed = async (
  profileId,
  message,
) => {
  await DB.query(
    `UPDATE country_intelligence_profiles
     SET
       status = 'FAILED',
       error_summary = $2,
       updated_at = NOW()
     WHERE id = $1`,
    [profileId, String(message).slice(0, 1500)],
  );
};

export const finishRun = async (
  runId,
  {
    completed,
    failed,
    errorSummary = null,
  },
) => {
  const status =
    failed === 0
      ? "COMPLETED"
      : completed === 0
        ? "FAILED"
        : "PARTIALLY_COMPLETED";

  await DB.query(
    `UPDATE country_intelligence_runs
     SET
       status = $2,
       completed_countries = $3,
       failed_countries = $4,
       error_summary = $5,
       completed_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [
      runId,
      status,
      completed,
      failed,
      errorSummary,
    ],
  );
};

export const getRun = async (runId, projectId) => {
  const { rows } = await DB.query(
    Q.GET_RUN_BY_ID,
    [runId, projectId],
  );

  if (!rows[0]) return null;

  const countries = await DB.query(
    Q.GET_RUN_COUNTRIES,
    [runId],
  );

  return {
    ...rows[0],
    countries: countries.rows,
  };
};

export const getLatestProfiles = async (projectId) => {
  const { rows } = await DB.query(
    Q.GET_LATEST_COUNTRY_PROFILES,
    [projectId],
  );

  return rows;
};

// Retrieve a specific profile by its UUID, scoped to its project.
export const getCountryProfileById = async (
  projectId,
  intelligenceId,
) => {
  const { rows } = await DB.query(
    Q.GET_COUNTRY_PROFILE_BY_ID,
    [projectId, intelligenceId],
  );

  if (!rows[0]) return null;

  const profile = rows[0];

  const [
    requirementsResult,
    sourcesResult,
  ] = await Promise.all([
    DB.query(
      Q.GET_PROFILE_REQUIREMENTS,
      [profile.intelligenceId],
    ),
    DB.query(
      Q.GET_PROFILE_SOURCES,
      [profile.intelligenceId],
    ),
  ]);

  const requirements = requirementsResult.rows;
  const sourceRows = sourcesResult.rows;

  const requirementIds = requirements.map(
    (item) => item.id,
  );

  let links = [];

  if (requirementIds.length) {
    const linkResult = await DB.query(
      Q.GET_REQUIREMENT_SOURCE_LINKS,
      [requirementIds],
    );

    links = linkResult.rows;
  }

  const sourcesByRequirement = new Map();

  for (const link of links) {
    const existing =
      sourcesByRequirement.get(link.requirementId) ?? [];

    existing.push(link.sourceId);

    sourcesByRequirement.set(
      link.requirementId,
      existing,
    );
  }

  const sourceMap = new Map(
    sourceRows.map((source) => [source.id, source]),
  );

  const enrichedRequirements = requirements.map(
    (requirement) => ({
      ...requirement,
      evidence: (
        sourcesByRequirement.get(requirement.id) ?? []
      )
        .map((id) => sourceMap.get(id))
        .filter(Boolean),
    }),
  );

  return {
    ...profile,
    requirements: enrichedRequirements,
    sources: sourceRows,
  };
};
