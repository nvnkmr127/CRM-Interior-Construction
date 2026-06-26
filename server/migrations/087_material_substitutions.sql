-- Migration: 087_material_substitutions.sql
-- Description: Adds tables for Material Shortage and Substitution workflow.

CREATE TABLE IF NOT EXISTS material_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boq_item_id UUID NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason_shortage TEXT NOT NULL,
  replacement_item_name VARCHAR(255) NOT NULL,
  replacement_brand VARCHAR(100),
  replacement_material_specifications TEXT,
  replacement_unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  price_difference DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  client_approval_status VARCHAR(50) DEFAULT 'pending' CHECK (client_approval_status IN ('pending', 'approved', 'rejected')),
  client_approved_at TIMESTAMP,
  client_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_substitutions_project ON material_substitutions(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_substitutions_item ON material_substitutions(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_material_substitutions_status ON material_substitutions(tenant_id, status);
