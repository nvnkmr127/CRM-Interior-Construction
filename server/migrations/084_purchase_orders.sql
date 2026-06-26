-- Migration: 084_purchase_orders.sql
-- Description: Adds tables for Purchase Order (PO) system and links them to project vendors and budget expenses.

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  po_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'partially received', 'received', 'cancelled')),
  expected_delivery_date TIMESTAMP,
  notes TEXT,
  terms_conditions TEXT,
  total_amount DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_order_number UNIQUE (tenant_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON purchase_orders(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  brand VARCHAR(100),
  material_specifications TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id, tenant_id);

-- Add purchase_order_id column to project_expenses so we can link them
ALTER TABLE project_expenses
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_expenses_po ON project_expenses(purchase_order_id);
