-- Migration: 146_design_stage_workflow.sql
-- Description: Add columns for design stages and history to projects.

-- 1. Add design_stage column to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS design_stage VARCHAR(50) DEFAULT 'Requirement Gathering';

-- 2. Create project_design_stage_history table
CREATE TABLE IF NOT EXISTS project_design_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_confirmed BOOLEAN DEFAULT FALSE,
  client_confirmed_at TIMESTAMP,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_design_stage_history_project ON project_design_stage_history(project_id);
