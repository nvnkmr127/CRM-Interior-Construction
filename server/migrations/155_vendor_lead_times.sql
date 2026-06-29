-- Migration: 155_vendor_lead_times.sql
-- Description: Adds tables for vendor lead times configuration per material category and updates PR/PO items schema.

CREATE TABLE IF NOT EXISTS vendor_lead_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE CASCADE,
  material_category VARCHAR(100) NOT NULL,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to handle null vendor_id (default lead time for a category)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_vendor_lead_times ON vendor_lead_times (
  tenant_id, 
  (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
  material_category
);

-- Alter purchase_request_items table
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS material_category VARCHAR(100) DEFAULT 'general';

-- Alter purchase_order_items table
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS material_category VARCHAR(100) DEFAULT 'general';

-- Insert default configurations for the standard demo tenant
-- Fetch demo tenant ID dynamically in script or default to inserting when setup runs
DO $$
DECLARE
  demo_tenant_id UUID;
BEGIN
  SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo';
  IF demo_tenant_id IS NOT NULL THEN
    INSERT INTO vendor_lead_times (tenant_id, vendor_id, material_category, lead_time_days)
    VALUES
      (demo_tenant_id, NULL, 'plywood', 7),
      (demo_tenant_id, NULL, 'hardware', 3),
      (demo_tenant_id, NULL, 'laminate', 5),
      (demo_tenant_id, NULL, 'paint', 3),
      (demo_tenant_id, NULL, 'electrical', 4),
      (demo_tenant_id, NULL, 'plumbing', 4),
      (demo_tenant_id, NULL, 'modular', 15),
      (demo_tenant_id, NULL, 'general', 5)
    ON CONFLICT (tenant_id, (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)), material_category)
    DO UPDATE SET lead_time_days = EXCLUDED.lead_time_days;
  END IF;
END $$;
