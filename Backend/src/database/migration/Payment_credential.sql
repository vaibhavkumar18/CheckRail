-- ============================================
-- CorridorGate: Payment Credentials
-- ============================================

CREATE TABLE IF NOT EXISTS payment_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    integration_id UUID NOT NULL
        REFERENCES integrations(id)
        ON DELETE CASCADE,

    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('PAYPAL')),

    environment VARCHAR(20) NOT NULL
        CHECK (environment IN ('SANDBOX', 'LIVE')),

    client_id TEXT NOT NULL
        CHECK (LENGTH(TRIM(client_id)) > 0),

    client_secret_encrypted TEXT NOT NULL,

    encryption_iv VARCHAR(32) NOT NULL,

    encryption_auth_tag VARCHAR(32) NOT NULL,

    webhook_id VARCHAR(255),

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    updated_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_integration_provider_environment
        UNIQUE (integration_id, provider, environment)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payment_credentials_integration_id
    ON payment_credentials(integration_id);

CREATE INDEX IF NOT EXISTS idx_payment_credentials_provider_environment
    ON payment_credentials(provider, environment);