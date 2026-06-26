-- Migration: 090_production_dispatch.sql
-- Description: Adds tables for Dispatch Tracking and Transport Logistics.

CREATE TABLE IF NOT EXISTS production_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  dispatch_number VARCHAR(100) NOT NULL,
  dispatch_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vehicle_number VARCHAR(100),
  driver_name VARCHAR(255),
  driver_contact VARCHAR(100),
  expected_delivery_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'delivered', 'failed_delivery')),
  actual_delivery_date TIMESTAMP,
  received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by_name VARCHAR(255),
  receipt_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_dispatch_number UNIQUE (tenant_id, dispatch_number)
);

CREATE INDEX IF NOT EXISTS idx_production_dispatches_order ON production_dispatches(production_order_id, tenant_id);
