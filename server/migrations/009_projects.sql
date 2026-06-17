CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID,                         -- source lead (nullable — direct creation allowed)
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),
  pm_id UUID REFERENCES users(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contract_value DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'active',  -- active, on_hold, completed, cancelled
  start_date DATE,
  target_date DATE,
  site_address TEXT,
  custom_fields TEXT DEFAULT '{}',
  deleted_at TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status);
