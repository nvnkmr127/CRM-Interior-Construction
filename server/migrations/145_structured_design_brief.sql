-- Migration: 145_structured_design_brief.sql
-- Description: Add columns for structured brief to lead_preferences and project_design_requirements tables.

-- 1. Add fields to project_design_requirements table
ALTER TABLE project_design_requirements
  ADD COLUMN IF NOT EXISTS family_size INTEGER,
  ADD COLUMN IF NOT EXISTS usage_patterns TEXT,
  ADD COLUMN IF NOT EXISTS storage_priorities TEXT,
  ADD COLUMN IF NOT EXISTS brand_flexibility VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand_remarks TEXT,
  ADD COLUMN IF NOT EXISTS existing_furniture TEXT,
  ADD COLUMN IF NOT EXISTS budget_category_allocation JSONB DEFAULT '{}'::jsonb;

-- 2. Add fields to lead_preferences table
ALTER TABLE lead_preferences
  ADD COLUMN IF NOT EXISTS family_size INTEGER,
  ADD COLUMN IF NOT EXISTS usage_patterns TEXT,
  ADD COLUMN IF NOT EXISTS storage_priorities TEXT,
  ADD COLUMN IF NOT EXISTS brand_flexibility VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand_remarks TEXT,
  ADD COLUMN IF NOT EXISTS existing_furniture TEXT,
  ADD COLUMN IF NOT EXISTS budget_category_allocation JSONB DEFAULT '{}'::jsonb;
