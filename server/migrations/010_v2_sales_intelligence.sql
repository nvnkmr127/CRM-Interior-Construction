-- Migration 010: V2 Sales Intelligence Additions

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'Low';

CREATE TABLE IF NOT EXISTS lead_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  suggested_rebuttal TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_objections_lead_id ON lead_objections(lead_id);
