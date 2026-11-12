export const GET_DASHBOARD = `
  WITH user_organizations AS (
    SELECT DISTINCT
      o.id,
      o.name,
      o.owner_id,
      o.created_at
    FROM organizations o
    WHERE
      o.owner_id = $1
      OR EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = o.id
          AND om.user_id = $1
      )
  ),

  user_projects AS (
    SELECT
      p.id,
      p.organization_id,
      p.name,
      p.provider,
      p.source_country,
      p.target_countries,
      p.created_at,
      p.updated_at,
      o.name AS organization_name
    FROM projects p
    INNER JOIN user_organizations o
      ON o.id = p.organization_id
  )

  SELECT
    (SELECT COUNT(*)::int
      FROM user_organizations
    ) AS organization_count,

    (SELECT COUNT(*)::int
      FROM user_projects
    ) AS project_count,

    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(recent_projects))
        FROM (
          SELECT
            p.id,
            p.organization_id,
            p.organization_name,
            p.name,
            p.provider,
            p.source_country,
            p.target_countries,
            p.created_at,
            p.updated_at
          FROM user_projects p
          ORDER BY p.updated_at DESC, p.created_at DESC
          LIMIT 8
        ) recent_projects
      ),
      '[]'::jsonb
    ) AS recent_projects;
`;