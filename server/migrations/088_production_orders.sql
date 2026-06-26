-- Migration: 088_production_orders.sql
-- Description: Adds tables for Production Order system to track item-wise production schedules, factory assignments, QC status, packaging, and dispatch dates.

CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_production', 'completed', 'cancelled')),
  factory_name VARCHAR(255),
  expected_completion_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_order_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_project ON production_orders(project_id, tenant_id);

CREATE TABLE IF NOT EXISTS production_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  factory_assignment VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed', 'cancelled')),
  production_start_date TIMESTAMP,
  production_complete_date TIMESTAMP,
  qc_status VARCHAR(50) DEFAULT 'pending' CHECK (qc_status IN ('pending', 'passed', 'failed')),
  packaging_status VARCHAR(50) DEFAULT 'pending' CHECK (packaging_status IN ('pending', 'packaged', 'dispatched')),
  dispatch_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_items_order ON production_order_items(production_order_id, tenant_id);
