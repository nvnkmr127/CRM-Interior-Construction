CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  project_id UUID,                   -- set when activity is on a project
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,         -- 'call','note','email','whatsapp','site_visit','meeting'
  title VARCHAR(255),
  notes TEXT,
  outcome VARCHAR(100),              -- 'connected','no_answer','interested','callback'
  scheduled_at TEXT,
  completed_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
