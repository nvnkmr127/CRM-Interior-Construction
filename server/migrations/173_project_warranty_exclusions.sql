ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS warranty_exclusions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged_by VARCHAR(255);
