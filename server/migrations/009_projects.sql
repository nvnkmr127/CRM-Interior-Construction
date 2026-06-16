CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id TEXT,                         -- source lead (nullable — direct creation allowed)
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),
  pm_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  designer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  contract_value DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'active',  -- active, on_hold, completed, cancelled
  start_date DATE,
  target_date DATE,
  site_address TEXT,
  custom_fields TEXT DEFAULT '{}',
  deleted_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status);
