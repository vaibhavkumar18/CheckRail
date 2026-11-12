CREATE TABLE IF NOT EXISTS integration_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id UUID NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    original_filename VARCHAR(255) NOT NULL,

    source_type VARCHAR(20) NOT NULL
        CHECK (source_type IN ('ZIP', 'OPENAPI')),

    mime_type VARCHAR(150),

    file_size BIGINT NOT NULL
        CHECK (file_size > 0),

    sha256 CHAR(64) NOT NULL
        CHECK (sha256 ~ '^[a-f0-9]{64}$'),

    storage_provider VARCHAR(30) NOT NULL DEFAULT 'CLOUDINARY'
        CHECK (storage_provider = 'CLOUDINARY'),

    storage_asset_id VARCHAR(255) NOT NULL,

    storage_public_id VARCHAR(500) NOT NULL,

    resource_type VARCHAR(30) NOT NULL DEFAULT 'raw',

    delivery_type VARCHAR(30) NOT NULL DEFAULT 'authenticated'
        CHECK (delivery_type IN ('authenticated', 'private')),

    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED'
        CHECK (
            status IN (
                'UPLOADED',
                'PROCESSING',
                'READY',
                'FAILED'
            )
        ),

    uploaded_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_sources_project_id
    ON integration_sources(project_id);

CREATE INDEX IF NOT EXISTS idx_integration_sources_uploaded_by
    ON integration_sources(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_integration_sources_status
    ON integration_sources(status);

CREATE INDEX IF NOT EXISTS idx_integration_sources_created_at
    ON integration_sources(created_at DESC);



    CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source_id UUID NOT NULL UNIQUE
        REFERENCES integration_sources(id)
        ON DELETE CASCADE,

    project_id UUID NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    integration_profile JSONB NOT NULL
        CHECK (jsonb_typeof(integration_profile) = 'object'),

    review_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            review_status IN (
                'PENDING',
                'CONFIRMED'
            )
        ),

    confirmed_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    confirmed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_project_id
    ON integrations(project_id);

CREATE INDEX IF NOT EXISTS idx_integrations_review_status
    ON integrations(review_status);



    ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS original_profile JSONB;

UPDATE integrations
SET original_profile = integration_profile
WHERE original_profile IS NULL;

ALTER TABLE integrations
ALTER COLUMN original_profile SET NOT NULL;