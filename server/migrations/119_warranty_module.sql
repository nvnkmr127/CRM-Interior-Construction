-- Migration: 119_warranty_module.sql
-- Description: Creates the warranties table for product-wise warranty tracking.

CREATE TABLE IF NOT EXISTS warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  handover_item_id UUID REFERENCES handover_items(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  serial_number VARCHAR(100),
  brand VARCHAR(100),
  brand_warranty_months INT DEFAULT 0,
  company_warranty_months INT DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  warranty_document VARCHAR(1000), -- S3/Local upload file key
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'voided'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warranties_tenant ON warranties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranties_project ON warranties(project_id);
CREATE INDEX IF NOT EXISTS idx_warranties_handover_item ON warranties(handover_item_id);
CREATE INDEX IF NOT EXISTS idx_warranties_status ON warranties(tenant_id, status);
