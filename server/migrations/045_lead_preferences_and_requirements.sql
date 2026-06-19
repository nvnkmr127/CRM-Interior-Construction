-- Migration: 045_lead_preferences_and_requirements.sql

CREATE TABLE IF NOT EXISTS lead_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  interior_style VARCHAR(100),
  color_theme VARCHAR(100),
  material VARCHAR(100),
  kitchen_style VARCHAR(100),
  wardrobe_style VARCHAR(100),
  lighting VARCHAR(100),
  flooring VARCHAR(100),
  budget_level VARCHAR(50),
  luxury_level VARCHAR(50),
  preferred_brand VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_preferences_lead ON lead_preferences(lead_id);

CREATE TABLE IF NOT EXISTS lead_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  room VARCHAR(100),
  work_type VARCHAR(100),
  priority VARCHAR(50),
  estimated_budget NUMERIC(12,2),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_requirements_lead ON lead_requirements(lead_id);
