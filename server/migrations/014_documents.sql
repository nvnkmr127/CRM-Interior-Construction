CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  name VARCHAR(500) NOT NULL,
  doc_type VARCHAR(100),     -- 'drawing','boq','render','contract','photo','invoice'
  version BOOLEAN DEFAULT TRUE,
  storage_key VARCHAR(1000) NOT NULL,  -- S3 object key
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending_review', -- pending_review, approved, revision_requested
  approved_by UUID REFERENCES users(id),
  approved_at TEXT,
  revision_note TEXT,
  is_visible_to_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_phase ON documents(phase_id);
