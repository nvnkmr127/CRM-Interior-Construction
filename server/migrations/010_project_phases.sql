CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  duration_days INTEGER,
  starts_at DATE,
  ends_at DATE,
  sign_off_required BOOLEAN DEFAULT true,
  sign_off_by VARCHAR(50) DEFAULT 'pm',  -- 'pm','designer','client','all'
  signed_off_by UUID REFERENCES users(id),
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
