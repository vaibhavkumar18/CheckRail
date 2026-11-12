-- ============================================
-- CorridorGate: Organization Members
-- ============================================

CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('ADMIN', 'DEVELOPER', 'REVIEWER')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_organization_member
        UNIQUE (organization_id, user_id)
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
    ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id
    ON organization_members(organization_id);