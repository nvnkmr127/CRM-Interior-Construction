-- Migration: 075_design_assets.sql
-- Description: Adds tables for design assets (mood boards, concept presentations, and reference collections) and tracks client feedback/approvals.

CREATE TABLE IF NOT EXISTS design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  asset_type VARCHAR(50) NOT NULL, -- 'mood_board', 'concept_board', 'reference_collection'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'revision_requested'
  is_visible_to_client BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_approved_at TIMESTAMP,
  client_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_assets_project ON design_assets(project_id);

CREATE TABLE IF NOT EXISTS design_asset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  design_asset_id UUID NOT NULL REFERENCES design_assets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_asset_items_asset ON design_asset_items(design_asset_id);
