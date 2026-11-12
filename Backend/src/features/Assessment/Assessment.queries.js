export const INSERT_ASSESSMENT_RUN = `
    INSERT INTO assessment_runs (
        integration_id,
        assessment_type,
        assessment_status,
        result,
        created_by
    )
    VALUES (
        $1,
        'PRELIMINARY_SOURCE',
        $2,
        $3::jsonb,
        $4
    )
    ON CONFLICT (integration_id)
    DO NOTHING
    RETURNING *;
`;

export const GET_ASSESSMENT_BY_INTEGRATION = `
    SELECT *
    FROM assessment_runs
    WHERE integration_id = $1
    LIMIT 1;
`;