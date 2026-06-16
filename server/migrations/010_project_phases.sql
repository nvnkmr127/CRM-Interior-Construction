CREATE TABLE IF NOT EXISTS project_phases (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  duration_days INTEGER,
  starts_at DATE,
  ends_at DATE,
  sign_off_required BOOLEAN DEFAULT true,
  sign_off_by VARCHAR(50) DEFAULT 'pm',  -- 'pm','designer','client','all'
  signed_off_by TEXT REFERENCES users(id),
  signed_off_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
