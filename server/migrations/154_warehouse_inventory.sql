-- Migration: 154_warehouse_inventory.sql
-- Description: Creates tables for Warehouses, Inventory items, Quarantined inventory, and Inventory Transactions logs.

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_warehouse_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) DEFAULT 0.00,
  unit VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Project Tagging (null = general stock)
  bin_location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_inventory_item ON inventory_items (
  tenant_id, 
  warehouse_id, 
  item_name, 
  (COALESCE(brand, '')), 
  (COALESCE(material_specifications, '')), 
  (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE TABLE IF NOT EXISTS quarantined_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) DEFAULT 0.00,
  unit VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Tagged project
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_quarantined_item ON quarantined_items (
  tenant_id, 
  warehouse_id, 
  item_name, 
  (COALESCE(brand, '')), 
  (COALESCE(material_specifications, '')), 
  (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
  (COALESCE(reason, ''))
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('receipt', 'dispatch_to_site', 'return_from_site', 'quarantine_damaged', 'release_from_quarantine', 'write_off')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
