-- CorridorGate AI Gap Analysis persistence.
-- This migration adds new tables only; it does not alter existing project,
-- integration, credential, verification, or Country Intelligence tables.

CREATE TABLE IF NOT EXISTS ai_gap_analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,

    integration_id UUID NOT NULL
        REFERENCES integrations(id) ON DELETE CASCADE,

    capability_run_id UUID NOT NULL
        REFERENCES capability_verification_runs(id) ON DELETE CASCADE,

    country_profile_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

    provider VARCHAR(40) NOT NULL,
    environment VARCHAR(30) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),

    model VARCHAR(160),
    ai_request_id VARCHAR(160),
    ai_usage JSONB,

    -- Exact sanitized context supplied to the model. No plaintext credentials
    -- are included in this snapshot.
    evidence_snapshot JSONB,

    -- Validated, structured AI report plus deterministic metadata.
    report JSONB,

    error_code VARCHAR(100),
    error_message TEXT,

    created_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_gap_analysis_project_created
    ON ai_gap_analysis_runs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_gap_analysis_capability_run
    ON ai_gap_analysis_runs(capability_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_gap_analysis_integration
    ON ai_gap_analysis_runs(integration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_gap_analysis_status
    ON ai_gap_analysis_runs(status, created_at DESC);
