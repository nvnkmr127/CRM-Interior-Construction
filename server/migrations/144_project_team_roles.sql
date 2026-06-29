-- Migration: 144_project_team_roles.sql
-- Description: Add project team user reference columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lead_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS junior_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qc_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_executive_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS procurement_officer_id UUID REFERENCES users(id) ON DELETE SET NULL;
