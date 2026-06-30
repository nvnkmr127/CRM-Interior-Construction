-- Migration: 156_factory_production_stages_and_cutting_lists.sql
-- Description: Adds columns for factory production stages (cutting, edge banding, drilling, assembly) and creates tables for cutting lists and CNC request tracking.

-- 1. Alter production_order_items to add production stage tracking columns
ALTER TABLE production_order_items DROP COLUMN IF EXISTS cutting_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS edge_banding_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS drilling_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS assembly_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS cnc_status CASCADE;

ALTER TABLE production_order_items 
ADD COLUMN cutting_status VARCHAR(50) DEFAULT 'pending' CHECK (cutting_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN edge_banding_status VARCHAR(50) DEFAULT 'pending' CHECK (edge_banding_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN drilling_status VARCHAR(50) DEFAULT 'pending' CHECK (drilling_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN assembly_status VARCHAR(50) DEFAULT 'pending' CHECK (assembly_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN cnc_status VARCHAR(50) DEFAULT 'not_required' CHECK (cnc_status IN ('not_required', 'pending_request', 'generated', 'completed'));

-- 2. Create Cutting Lists Table
CREATE TABLE IF NOT EXISTS production_cutting_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  panel_name VARCHAR(255) NOT NULL,
  length_mm DECIMAL(10, 2) NOT NULL,
  width_mm DECIMAL(10, 2) NOT NULL,
  thickness_mm DECIMAL(10, 2) NOT NULL,
  material VARCHAR(255) NOT NULL,
  edge_banding VARCHAR(255) NOT NULL DEFAULT 'none',
  quantity INTEGER NOT NULL DEFAULT 1,
  cnc_program_name VARCHAR(255),
  cnc_status VARCHAR(50) DEFAULT 'not_required' CHECK (cnc_status IN ('not_required', 'requested', 'completed')),
  cnc_notes TEXT,
  assembly_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cutting_lists_item ON production_cutting_lists(production_order_item_id, tenant_id);

-- 3. Create CNC Requests Table
CREATE TABLE IF NOT EXISTS production_cnc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  request_number VARCHAR(100) NOT NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  program_file_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_cnc_request_number UNIQUE (tenant_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_cnc_requests_project ON production_cnc_requests(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_cnc_requests_order ON production_cnc_requests(production_order_id, tenant_id);
