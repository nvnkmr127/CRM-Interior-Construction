-- Migration: 078_add_project_revision_limits.sql
-- Description: Adds configuration for allowed design revisions, counts current revisions, and creates a Change Orders table.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS allowed_design_revisions INTEGER DEFAULT 3;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_design_revisions INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project ON project_change_orders(project_id);
