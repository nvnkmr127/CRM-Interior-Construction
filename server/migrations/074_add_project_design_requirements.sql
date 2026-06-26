-- Migration: 074_add_project_design_requirements.sql
-- Description: Adds tables for project-level design requirements, room-by-room requirements, and inspirations.

CREATE TABLE IF NOT EXISTS project_design_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interior_style VARCHAR(255),
  color_theme VARCHAR(255),
  material_preference TEXT,
  kitchen_style VARCHAR(255),
  wardrobe_style VARCHAR(255),
  lighting_preference TEXT,
  flooring_preference TEXT,
  lifestyle_inputs TEXT,
  must_haves TEXT,
  nice_to_haves TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_design_requirements UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_proj_design_reqs_project ON project_design_requirements(project_id);

CREATE TABLE IF NOT EXISTS project_room_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  budget_allocation DECIMAL(12,2),
  priority VARCHAR(50),
  functional_requirements TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proj_room_reqs_project ON project_room_requirements(project_id);

CREATE TABLE IF NOT EXISTS project_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  room_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_inspirations_project ON project_inspirations(project_id);
