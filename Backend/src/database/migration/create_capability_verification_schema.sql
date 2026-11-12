-- =====================================================
-- 1. Capability Verification Runs
-- =====================================================

CREATE TABLE IF NOT EXISTS capability_verification_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id UUID NOT NULL
        REFERENCES integrations(id)
        ON DELETE CASCADE,

    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('PAYPAL', 'HYPERWALLET')),

    environment VARCHAR(20) NOT NULL
        CHECK (environment IN ('SANDBOX', 'UAT', 'LIVE')),

    capability_code VARCHAR(100) NOT NULL,

    overall_status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED'
        CHECK (
            overall_status IN (
                'VERIFIED',
                'FAILED',
                'UNVERIFIED'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        completed_at IS NULL
        OR completed_at >= started_at
    )
);


CREATE INDEX IF NOT EXISTS idx_capability_runs_integration
    ON capability_verification_runs(integration_id);

CREATE INDEX IF NOT EXISTS idx_capability_runs_status
    ON capability_verification_runs(overall_status);

CREATE INDEX IF NOT EXISTS idx_capability_runs_created_at
    ON capability_verification_runs(created_at DESC);


-- =====================================================
-- 2. Capability Verification Checks
-- =====================================================

CREATE TABLE IF NOT EXISTS capability_verification_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    run_id UUID NOT NULL
        REFERENCES capability_verification_runs(id)
        ON DELETE CASCADE,

    operation VARCHAR(100) NOT NULL,

    status VARCHAR(20) NOT NULL
        CHECK (
            status IN (
                'PASSED',
                'FAILED',
                'NOT_RUN'
            )
        ),

    message TEXT,

    provider_status INTEGER,

    resource_id VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (run_id, operation)
);


CREATE INDEX IF NOT EXISTS idx_capability_checks_run
    ON capability_verification_checks(run_id);

CREATE INDEX IF NOT EXISTS idx_capability_checks_status
    ON capability_verification_checks(status);


-- =====================================================
-- 3. Capability Verification Evidence
-- =====================================================

CREATE TABLE IF NOT EXISTS capability_verification_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    run_id UUID NOT NULL
        REFERENCES capability_verification_runs(id)
        ON DELETE CASCADE,

    check_id UUID
        REFERENCES capability_verification_checks(id)
        ON DELETE SET NULL,

    evidence_type VARCHAR(50) NOT NULL,

    operation VARCHAR(100) NOT NULL,

    http_method VARCHAR(10),

    endpoint VARCHAR(500),

    http_status INTEGER,

    resource_id VARCHAR(255),

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(metadata) = 'object'),

    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_capability_evidence_run
    ON capability_verification_evidence(run_id);

CREATE INDEX IF NOT EXISTS idx_capability_evidence_check
    ON capability_verification_evidence(check_id);

CREATE INDEX IF NOT EXISTS idx_capability_evidence_operation
    ON capability_verification_evidence(operation);

CREATE INDEX IF NOT EXISTS idx_capability_evidence_observed
    ON capability_verification_evidence(observed_at DESC);