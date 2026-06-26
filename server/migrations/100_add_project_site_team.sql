-- Migration: 100_add_project_site_team.sql
-- Description: Adds project_site_team table for contractor and labour tracking.

CREATE TABLE IF NOT EXISTS project_site_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  role VARCHAR(100) NOT NULL, -- carpenter, electrician, plumber, painter, supervisor, other
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_site_team_project ON project_site_team(project_id);
