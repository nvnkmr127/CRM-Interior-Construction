-- Migration: 171_project_installation_warranty.sql
-- Description: Adds project-level installation warranty tracking to the projects table.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS installation_warranty_start_date DATE,
  ADD COLUMN IF NOT EXISTS installation_warranty_end_date DATE,
  ADD COLUMN IF NOT EXISTS installation_warranty_scope TEXT,
  ADD COLUMN IF NOT EXISTS installation_warranty_status VARCHAR(50) DEFAULT 'active';

-- Add index on status for faster querying of active/expired warranties across projects
CREATE INDEX IF NOT EXISTS idx_projects_installation_warranty_status ON projects(tenant_id, installation_warranty_status);
