CREATE TABLE IF NOT EXISTS lead_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  storage_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON lead_files(lead_id);
