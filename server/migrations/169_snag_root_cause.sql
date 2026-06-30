-- Migration: 169_snag_root_cause.sql
-- Description: Adds root cause category and vendor tracking to snags for defect root cause analysis.

ALTER TABLE snags 
  ADD COLUMN IF NOT EXISTS root_cause_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES project_vendors(id);

CREATE INDEX IF NOT EXISTS idx_snags_root_cause ON snags(tenant_id, root_cause_category);
CREATE INDEX IF NOT EXISTS idx_snags_vendor ON snags(tenant_id, vendor_id);
