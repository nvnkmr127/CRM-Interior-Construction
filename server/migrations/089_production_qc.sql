-- Migration: 089_production_qc.sql
-- Description: Adds tables for Factory Quality Control (QC) Inspections, Rework Orders, and updates production orders with dispatch clearance fields.

-- 1. Create QC Inspections Table
CREATE TABLE IF NOT EXISTS production_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('passed', 'failed')),
  notes TEXT,
  photo_keys TEXT DEFAULT '[]', -- JSON array of S3 photo keys
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_item ON production_qc_inspections(production_order_item_id, tenant_id);

-- 2. Create Rework Orders Table
CREATE TABLE IF NOT EXISTS production_rework_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  qc_inspection_id UUID REFERENCES production_qc_inspections(id) ON DELETE SET NULL,
  rework_number VARCHAR(100) NOT NULL,
  rework_instructions TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'verified')),
  assigned_to VARCHAR(255),
  target_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_rework_order_number UNIQUE (tenant_id, rework_number)
);

CREATE INDEX IF NOT EXISTS idx_rework_orders_item ON production_rework_orders(production_order_item_id, tenant_id);

-- 3. Add dispatch clearance columns to production_orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS is_cleared_for_dispatch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;
