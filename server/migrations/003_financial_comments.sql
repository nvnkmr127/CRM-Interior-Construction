CREATE TABLE IF NOT EXISTS financial_approval_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    approval_id UUID NOT NULL REFERENCES financial_approvals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES financial_approval_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    mentions JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    reactions JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fac_approval_id ON financial_approval_comments(approval_id);
CREATE INDEX IF NOT EXISTS idx_fac_parent_id ON financial_approval_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_fac_tenant_id ON financial_approval_comments(tenant_id);

CREATE TABLE IF NOT EXISTS financial_approval_comment_reads (
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    approval_id UUID NOT NULL REFERENCES financial_approvals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id, approval_id, user_id)
);
