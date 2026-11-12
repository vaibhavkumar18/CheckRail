CREATE TABLE IF NOT EXISTS assessment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id UUID NOT NULL UNIQUE
        REFERENCES integrations(id)
        ON DELETE CASCADE,

    assessment_type VARCHAR(40) NOT NULL
        DEFAULT 'PRELIMINARY_SOURCE'
        CHECK (
            assessment_type = 'PRELIMINARY_SOURCE'
        ),

    assessment_status VARCHAR(20) NOT NULL
        CHECK (
            assessment_status IN (
                'COMPLETED',
                'INCOMPLETE'
            )
        ),

    result JSONB NOT NULL
        CHECK (jsonb_typeof(result) = 'object'),

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_runs_created_at
    ON assessment_runs(created_at DESC);