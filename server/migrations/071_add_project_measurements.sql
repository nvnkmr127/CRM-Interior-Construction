-- Migration: 071_add_project_measurements.sql
-- Description: Adds overall project measurement fields and room-wise site measurements.

-- 1. Add overall project measurement fields
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS carpet_area NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS built_up_area NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_rooms INTEGER DEFAULT 0;

-- 2. Create project room measurements table
CREATE TABLE IF NOT EXISTS project_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  length NUMERIC(10, 2) DEFAULT 0,
  width NUMERIC(10, 2) DEFAULT 0,
  height NUMERIC(10, 2) DEFAULT 0,
  area NUMERIC(10, 2) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'feet',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create index for fast retrieval of project measurements
CREATE INDEX IF NOT EXISTS idx_project_measurements_project ON project_measurements(project_id);
