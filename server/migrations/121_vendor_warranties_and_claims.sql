-- Migration: 121_vendor_warranties_and_claims.sql
-- Description: Adds vendor warranty fields and creates the warranty_claims table.

ALTER TABLE warranties
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_warranty_months INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_claim_procedure TEXT;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  warranty_id UUID REFERENCES warranties(id) ON DELETE SET NULL,
  claim_number VARCHAR(100) NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  nature_of_defect TEXT NOT NULL,
  eligibility_decision VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  eligibility_reason TEXT,
  assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  resolution_details TEXT,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, claim_number)
);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_tenant ON warranty_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_project ON warranty_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_warranty ON warranty_claims(warranty_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(tenant_id, status);
