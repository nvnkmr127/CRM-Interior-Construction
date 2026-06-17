CREATE TABLE IF NOT EXISTS snags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES users(id),            -- null if raised by portal client
  raised_by_client BOOLEAN DEFAULT false,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  photo_keys TEXT DEFAULT '[]',                  -- S3 keys for attached photos
  category VARCHAR(100),                          -- 'carpentry','electrical','plumbing','paint'
  assignee_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'open',
  -- open → assigned → in_progress → resolved → client_verified
  sla_hours INTEGER DEFAULT 48,
  resolved_at TEXT,
  resolution_note TEXT,
  client_verified_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snags_project ON snags(project_id);
CREATE INDEX IF NOT EXISTS idx_snags_status ON snags(tenant_id, status);
