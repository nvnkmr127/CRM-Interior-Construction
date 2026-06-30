-- Migration: 165_site_material_usages.sql
-- Description: Creates site_material_usages table to log daily material consumption at site.

CREATE TABLE IF NOT EXISTS site_material_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  activity_name VARCHAR(255) NOT NULL,
  material_name VARCHAR(255),
  quantity_used DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  date_used DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_mat_usages_project ON site_material_usages(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_mat_usages_po_item ON site_material_usages(po_item_id);
