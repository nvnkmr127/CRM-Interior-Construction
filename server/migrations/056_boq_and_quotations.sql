-- Migration: 056_boq_and_quotations.sql
-- Description: Adds robust Quotation and Bill of Quantities (BOQ) support, and links site visits to projects.

-- 1. Add project_id to site_visits
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- 2. Create Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  quotation_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected, revised
  version INTEGER DEFAULT 1,
  
  -- Totals
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  
  notes TEXT,
  terms_conditions TEXT,
  valid_until TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project ON quotations(project_id);

-- 3. Create Quotation Items Table (Bill of Quantities / BOQ)
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE NOT NULL,
  
  -- Hierarchical BOQ support (e.g. Living Room -> Sofa -> Fabric)
  parent_item_id UUID REFERENCES quotation_items(id) ON DELETE CASCADE,
  
  room_or_area VARCHAR(100), -- Optional categorizer
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pricing & Measurement
  unit VARCHAR(50), -- SqFt, Rft, Nos, etc.
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  markup_percentage NUMERIC(5,2) DEFAULT 0, -- For margin tracking
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + (markup_percentage / 100))) STORED,
  
  -- Execution metadata
  material_specifications TEXT,
  brand VARCHAR(100),
  
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
