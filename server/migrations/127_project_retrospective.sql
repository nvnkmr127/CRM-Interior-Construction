-- Migration: 127_project_retrospective.sql
-- Description: Create project_retrospectives and project_retrospective_vendors tables to track lessons learned and vendor ratings.

CREATE TABLE IF NOT EXISTS project_retrospectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  what_went_well TEXT,
  what_went_wrong TEXT,
  design_feedback TEXT,
  process_changes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_retrospectives_tenant ON project_retrospectives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_retrospectives_project ON project_retrospectives(project_id);

CREATE TABLE IF NOT EXISTS project_retrospective_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  retrospective_id UUID NOT NULL REFERENCES project_retrospectives(id) ON DELETE CASCADE,
  project_vendor_id UUID NOT NULL REFERENCES project_vendors(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(retrospective_id, project_vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_retrospective_vendors_retrospective ON project_retrospective_vendors(retrospective_id);
CREATE INDEX IF NOT EXISTS idx_retrospective_vendors_project_vendor ON project_retrospective_vendors(project_vendor_id);
