-- Migration: 133_commercial_project_support.sql
-- Description: Adds columns and tables for commercial project compliance and multi-vendor coordination.

-- 1. Expose commercial category specific fields on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fire_noc_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS occupancy_permit_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retention_money_percentage DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS ld_clause_details TEXT,
  ADD COLUMN IF NOT EXISTS stakeholder_complexity VARCHAR(50) DEFAULT 'low';

-- 2. Add scheduling and blocker tracking on project_vendors
ALTER TABLE project_vendors
  ADD COLUMN IF NOT EXISTS scheduled_start_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_finish_date DATE,
  ADD COLUMN IF NOT EXISTS blocker_description TEXT,
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(50) DEFAULT 'pending';

-- 3. Create compliance checklist table
CREATE TABLE IF NOT EXISTS project_compliance_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, approved, not_applicable
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_project_compliance_checklists_project ON project_compliance_checklists(project_id);
