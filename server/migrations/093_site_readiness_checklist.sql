-- Migration: 093_site_readiness_checklist.sql
-- Description: Creates project site readiness checklist table.

CREATE TABLE IF NOT EXISTS project_site_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  photo_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_readiness_item UNIQUE (project_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_project_readiness_proj ON project_site_readiness(project_id, tenant_id);
