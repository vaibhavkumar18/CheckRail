-- CorridorGate: Country Intelligence
-- Run this migration once against the existing Neon PostgreSQL database.

CREATE TABLE IF NOT EXISTS country_intelligence_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(24) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED')),
    target_countries JSONB NOT NULL
        CHECK (jsonb_typeof(target_countries) = 'array'),
    total_countries INTEGER NOT NULL CHECK (total_countries >= 1),
    completed_countries INTEGER NOT NULL DEFAULT 0 CHECK (completed_countries >= 0),
    failed_countries INTEGER NOT NULL DEFAULT 0 CHECK (failed_countries >= 0),
    error_summary TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_country_intelligence_runs_project_created
    ON country_intelligence_runs(project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_country_intelligence_active_project_run
    ON country_intelligence_runs(project_id)
    WHERE status IN ('QUEUED', 'RUNNING');

CREATE TABLE IF NOT EXISTS country_intelligence_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES country_intelligence_runs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
    country_name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
    overview JSONB NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(overview) = 'object'),
    requirement_count INTEGER NOT NULL DEFAULT 0,
    source_count INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    researched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_country_profile_per_run UNIQUE (run_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_country_profiles_project_country
    ON country_intelligence_profiles(project_id, country_code, created_at DESC);

CREATE TABLE IF NOT EXISTS country_intelligence_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES country_intelligence_profiles(id) ON DELETE CASCADE,
    source_key VARCHAR(30) NOT NULL,
    source_name VARCHAR(500) NOT NULL,
    source_url TEXT NOT NULL,
    source_domain VARCHAR(255),
    published_at TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    excerpt TEXT NOT NULL DEFAULT '',
    source_score NUMERIC(6,5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_country_source_key UNIQUE (profile_id, source_key),
    CONSTRAINT uq_country_source_url UNIQUE (profile_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_country_sources_profile
    ON country_intelligence_sources(profile_id);

CREATE TABLE IF NOT EXISTS country_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES country_intelligence_profiles(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(240) NOT NULL,
    description TEXT NOT NULL,
    applicability VARCHAR(30) NOT NULL
        CHECK (applicability IN ('MARKETPLACE', 'MERCHANT', 'CUSTOMER', 'PAYMENT_PROVIDER', 'GENERAL')),
    evidence_status VARCHAR(20) NOT NULL
        CHECK (evidence_status IN ('CONFIRMED', 'UNVERIFIED', 'CONFLICTING')),
    confidence VARCHAR(10) NOT NULL
        CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
    confidence_score NUMERIC(4,3),
    limitations JSONB NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(limitations) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_country_requirements_profile_category
    ON country_requirements(profile_id, category);

CREATE TABLE IF NOT EXISTS country_requirement_sources (
    requirement_id UUID NOT NULL REFERENCES country_requirements(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES country_intelligence_sources(id) ON DELETE CASCADE,
    PRIMARY KEY (requirement_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_country_requirement_sources_source
    ON country_requirement_sources(source_id);
