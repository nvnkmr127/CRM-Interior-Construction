-- Migration: 107_invoice_generation.sql
-- Description: Create invoices table to track tax invoice details generated from payment milestones.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_milestone_id UUID UNIQUE REFERENCES payment_milestones(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Billing (Client/Buyer) info
  billing_name VARCHAR(255) NOT NULL,
  billing_address TEXT,
  billing_gstin VARCHAR(50),
  
  -- Company (Seller) info
  company_name VARCHAR(255) NOT NULL,
  company_address TEXT,
  company_gstin VARCHAR(50),
  
  -- Price Breakdown
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  cgst_amount DECIMAL(12,2) DEFAULT 0.00,
  sgst_amount DECIMAL(12,2) DEFAULT 0.00,
  igst_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  payment_terms VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  pdf_storage_key VARCHAR(500),
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_number ON invoices(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_milestone ON invoices(payment_milestone_id);
