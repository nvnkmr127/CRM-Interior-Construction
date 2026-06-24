-- Migration: Add project_id to lead_estimates for L-068 conversion fix
-- This allows estimates created during the lead lifecycle to remain linked
-- to the new project after a lead is converted.

ALTER TABLE lead_estimates
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lead_estimates_project_id ON lead_estimates(project_id);
