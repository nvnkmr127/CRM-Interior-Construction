-- Migration: 039_lead_estimates.sql

CREATE TABLE IF NOT EXISTS lead_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimator_reference_id VARCHAR(100), -- ID from third party estimator app
  status VARCHAR(50) DEFAULT 'draft',
  total_amount NUMERIC(12,2),
  pdf_url TEXT,
  payload JSONB, -- store raw data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_estimates_lead ON lead_estimates(lead_id);
