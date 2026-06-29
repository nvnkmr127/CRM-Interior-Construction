-- Migration: 136_project_commercial_approval.sql
-- Description: Adds project_commercial_approvals table to enforce design to execution transition check

CREATE TABLE IF NOT EXISTS project_commercial_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT unique_project_commercial_approval UNIQUE (tenant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_approvals_project ON project_commercial_approvals(project_id);
