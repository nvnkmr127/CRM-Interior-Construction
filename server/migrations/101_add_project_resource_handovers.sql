-- Migration: 101_add_project_resource_handovers.sql
-- Description: Adds project_resource_handovers table for PM and designer handover logs.

CREATE TABLE IF NOT EXISTS project_resource_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- pm, designer
  replaced_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handover_notes TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_resource_handovers_project ON project_resource_handovers(project_id);
