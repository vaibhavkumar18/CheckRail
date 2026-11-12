
import DB from "../../config/DB.js";

const projectColumns = `
    id,
    organization_id AS "organizationId",
    name,
    source_country AS "sourceCountry",
    target_countries AS "targetCountries",
    provider,
    integration_type AS "integrationType",
    description,
    created_by AS "createdBy",
    created_at AS "createdAt",
    updated_at AS "updatedAt"
`;

export const createProject = async ({
    organizationId,
    name,
    assessmentObjective,
    sourceCountry,
    targetCountries,
    provider,
    integrationType,
    description,
    createdBy,
}) => {
    const query = `
        INSERT INTO projects (
            organization_id,
            name,
            assessment_objective,
            source_country,
            target_countries,
            provider,
            integration_type,
            description,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
        RETURNING *
    `;

    const values = [
        organizationId,
        name,
        assessmentObjective,
        sourceCountry,
        JSON.stringify(targetCountries),
        provider,
        integrationType,
        description,
        createdBy,
    ];

    const { rows } = await DB.query(query, values);

    return rows[0];
};

// NEW: Get all projects accessible to the authenticated user.

export const getProjectsForUser = async (userId) => {
    const query = `
        SELECT
            p.id,
            p.organization_id AS "organizationId",
            p.name,
            p.source_country AS "sourceCountry",
            p.target_countries AS "targetCountries",
            p.provider,
            p.integration_type AS "integrationType",
            p.description,
            p.created_by AS "createdBy",
            p.created_at AS "createdAt",
            p.updated_at AS "updatedAt",

            o.name AS organization_name

        FROM projects p

        INNER JOIN organizations o
            ON o.id = p.organization_id

        WHERE
            (
                o.owner_id = $1

                OR EXISTS (
                    SELECT 1
                    FROM organization_members om
                    WHERE om.organization_id = p.organization_id
                      AND om.user_id = $1
                )
            )

        ORDER BY p.created_at DESC
    `;

    const { rows } = await DB.query(query, [userId]);

    return rows;
};


export const getProjectsByOrganization = async (organizationId) => {
    const query = `
        SELECT ${projectColumns}
        FROM projects
        WHERE organization_id = $1
        ORDER BY created_at DESC
    `;

    const { rows } = await DB.query(query, [organizationId]);

    return rows;
};

export const getProjectById = async (projectId) => {
    const query = `
        SELECT ${projectColumns}
        FROM projects
        WHERE id = $1
        LIMIT 1
    `;

    const { rows } = await DB.query(query, [projectId]);

    return rows[0] ?? null;
};

export const updateProject = async (projectId, fields) => {
    const columnMap = {
        name: "name",
        sourceCountry: "source_country",
        targetCountries: "target_countries",
        provider: "provider",
        integrationType: "integration_type",
        description: "description",
    };

    const assignments = [];
    const values = [];
    let index = 1;

    for (const [key, value] of Object.entries(fields)) {
        const column = columnMap[key];

        if (!column) continue;

        if (key === "targetCountries") {
            assignments.push(`${column} = $${index}::jsonb`);
            values.push(JSON.stringify(value));
        } else {
            assignments.push(`${column} = $${index}`);
            values.push(value);
        }

        index++;
    }

    if (assignments.length === 0) {
        return getProjectById(projectId);
    }

    assignments.push("updated_at = NOW()");
    values.push(projectId);

    const query = `
        UPDATE projects
        SET ${assignments.join(", ")}
        WHERE id = $${index}
        RETURNING ${projectColumns}
    `;

    const { rows } = await DB.query(query, values);

    return rows[0] ?? null;
};

export const deleteProject = async (projectId) => {
    const query = `
        DELETE FROM projects
        WHERE id = $1
        RETURNING id
    `;

    const { rows } = await DB.query(query, [projectId]);

    return rows[0] ?? null;
};
