-- Migration: 077_material_palettes.sql
-- Description: Adds schema for tracking color schemes and material palettes per room/category with client approval states.

CREATE TABLE IF NOT EXISTS project_material_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL, -- e.g., 'Living Room', 'Kitchen', 'Master Bedroom'
  item_name VARCHAR(255) NOT NULL, -- e.g., 'Wall Paint', 'Primary Laminate', 'Cabinet Hardware'
  brand VARCHAR(255),              -- e.g., 'Asian Paints', 'CenturyPly', 'Hafele'
  shade_code VARCHAR(100),         -- e.g., 'AP-9234', 'Golden Oak 823'
  finish VARCHAR(100),             -- e.g., 'Matte', 'High Gloss', 'Satin'
  image_url TEXT,                  -- Optional swatch/preview image or base64
  status VARCHAR(50) DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'revision_requested'
  client_feedback TEXT,
  client_approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_palettes_project ON project_material_palettes(project_id);
