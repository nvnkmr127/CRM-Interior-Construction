CREATE TABLE IF NOT EXISTS handover_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',   -- in_progress, signed_off
  signed_by_client_at TIMESTAMPTZ,
  client_name VARCHAR(255),
  client_otp_verified BOOLEAN DEFAULT false,
  pdf_key VARCHAR(1000),                       -- S3 key for generated PDF
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handover_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES handover_checklists(id) ON DELETE CASCADE,
  room VARCHAR(100),
  description VARCHAR(500) NOT NULL,
  photo_key VARCHAR(1000),
  is_checked BOOLEAN DEFAULT false,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES users(id)
);
