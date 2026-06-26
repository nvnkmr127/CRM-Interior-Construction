-- Migration: 085_material_deliveries.sql
-- Description: Adds tables for Material Delivery and Goods Receipt tracking system.

CREATE TABLE IF NOT EXISTS material_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  delivery_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'inspected', 'partially received', 'rejected')),
  expected_delivery_date TIMESTAMP,
  actual_receipt_date TIMESTAMP,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_material_delivery_number UNIQUE (tenant_id, delivery_number)
);

CREATE INDEX IF NOT EXISTS idx_material_deliveries_project ON material_deliveries(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_po ON material_deliveries(purchase_order_id);

CREATE TABLE IF NOT EXISTS material_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  material_delivery_id UUID NOT NULL REFERENCES material_deliveries(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_expected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_damaged BOOLEAN DEFAULT FALSE,
  damage_description TEXT,
  condition_notes TEXT,
  photo_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_md_items_delivery ON material_delivery_items(material_delivery_id, tenant_id);
