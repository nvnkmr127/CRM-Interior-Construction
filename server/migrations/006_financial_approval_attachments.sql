CREATE TABLE IF NOT EXISTS financial_approval_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  approval_id UUID NOT NULL REFERENCES financial_approvals(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES financial_approval_attachments(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'replaced')),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_faa_approval ON financial_approval_attachments(approval_id, status);

