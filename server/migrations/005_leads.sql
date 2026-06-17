CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  source VARCHAR(100),              -- 'facebook','website','indimart','manual'
  stage_id UUID,                    -- FK added after lead_stages created in 006
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  score BOOLEAN DEFAULT FALSE,
  custom_fields TEXT DEFAULT '{}',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  converted_to_project_id UUID,     -- set when lead→project
  deleted_at TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assignee ON leads(assignee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(tenant_id, status);
