-- Migration: 152_purchase_requests.sql
-- Description: Adds tables for Purchase Request (PR) system and links them to projects, users, BOQ items, and Purchase Orders.

CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pr_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'cancelled')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  required_by_date TIMESTAMP NOT NULL,
  delivery_location VARCHAR(100) DEFAULT 'site' CHECK (delivery_location IN ('warehouse', 'site')),
  notes TEXT,
  pm_feedback TEXT,
  total_amount DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_request_number UNIQUE (tenant_id, pr_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_project ON purchase_requests(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  brand VARCHAR(100),
  material_specifications TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON purchase_request_items(purchase_request_id, tenant_id);

-- Link purchase requests to purchase orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_pr ON purchase_orders(purchase_request_id);

ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS pr_item_id UUID REFERENCES purchase_request_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_pr_item ON purchase_order_items(pr_item_id);
