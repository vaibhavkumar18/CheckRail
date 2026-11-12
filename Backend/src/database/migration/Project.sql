CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE RESTRICT,

    name VARCHAR(100) NOT NULL,

    source_country CHAR(2) NOT NULL,

    target_countries JSONB NOT NULL,

    provider VARCHAR(20) NOT NULL
        CHECK (provider IN ('PAYPAL', 'STRIPE', 'WISE', 'OTHER')),

    integration_type VARCHAR(20) NOT NULL
        CHECK (integration_type = 'PAYOUT'),

    description VARCHAR(500) NOT NULL DEFAULT '',

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT project_name_not_blank
        CHECK (LENGTH(TRIM(name)) >= 3),

    CONSTRAINT valid_source_country
        CHECK (source_country ~ '^[A-Z]{2}$'),

    CONSTRAINT valid_target_countries
        CHECK (
            jsonb_typeof(target_countries) = 'array'
            AND jsonb_array_length(target_countries) BETWEEN 1 AND 20
        )
);

CREATE INDEX IF NOT EXISTS idx_projects_organization_id
    ON projects(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_created_by
    ON projects(created_by);