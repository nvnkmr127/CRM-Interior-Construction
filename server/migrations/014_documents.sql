CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id TEXT REFERENCES project_phases(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  name VARCHAR(500) NOT NULL,
  doc_type VARCHAR(100),     -- 'drawing','boq','render','contract','photo','invoice'
  version INTEGER DEFAULT 1,
  storage_key VARCHAR(1000) NOT NULL,  -- S3 object key
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  uploaded_by TEXT REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending_review', -- pending_review, approved, revision_requested
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  revision_note TEXT,
  is_visible_to_client BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_phase ON documents(phase_id);
