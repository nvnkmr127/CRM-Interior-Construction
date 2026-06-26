-- Migration: 091_transit_damage.sql
-- Description: Adds tables for Transit Damage Tracking.

CREATE TABLE IF NOT EXISTS production_transit_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_dispatch_id UUID NOT NULL REFERENCES production_dispatches(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  damage_number VARCHAR(100) NOT NULL,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  quantity_damaged DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  damage_severity VARCHAR(50) NOT NULL CHECK (damage_severity IN ('minor', 'major', 'critical')),
  liability_type VARCHAR(50) DEFAULT 'undetermined' CHECK (liability_type IN ('transporter', 'vendor', 'insurance_claim', 'undetermined')),
  status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'claim_filed', 'replacement_initiated', 'resolved')),
  description TEXT NOT NULL,
  photo_keys TEXT DEFAULT '[]', -- JSON array of photo keys
  replacement_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  resolution_timeline TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_transit_damage_number UNIQUE (tenant_id, damage_number)
);

CREATE INDEX IF NOT EXISTS idx_transit_damage_dispatch ON production_transit_damages(production_dispatch_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_transit_damage_item ON production_transit_damages(production_order_item_id, tenant_id);
