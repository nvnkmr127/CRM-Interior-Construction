-- Migration: 148_layout_tracking_and_mep_checklist.sql
-- Description: Add layout type classification, approval workflows, and MEP checklists

-- 1. Add layout tracking columns to drawing_register
ALTER TABLE drawing_register
  ADD COLUMN IF NOT EXISTS layout_type VARCHAR(50) CHECK (layout_type IN ('electrical', 'plumbing', 'civil', 'false_ceiling', 'furniture', 'flooring')),
  ADD COLUMN IF NOT EXISTS client_status VARCHAR(50) DEFAULT 'pending' CHECK (client_status IN ('pending', 'approved', 'revision_requested')),
  ADD COLUMN IF NOT EXISTS client_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS contractor_status VARCHAR(50) DEFAULT 'pending' CHECK (contractor_status IN ('pending', 'approved', 'revision_requested')),
  ADD COLUMN IF NOT EXISTS contractor_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contractor_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS contractor_notes TEXT;

-- 2. Create project_mep_checklists table
CREATE TABLE IF NOT EXISTS project_mep_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'not_applicable')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_project_mep_checklists_project ON project_mep_checklists(project_id);
