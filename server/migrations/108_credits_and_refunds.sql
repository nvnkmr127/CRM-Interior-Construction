-- Migration: 108_credits_and_refunds.sql
-- Description: Create credit_notes and refunds tables to manage deductions, credits, and customer refunds.

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number VARCHAR(100) NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  cgst_amount DECIMAL(12,2) DEFAULT 0.00,
  sgst_amount DECIMAL(12,2) DEFAULT 0.00,
  igst_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('issued', 'void')),
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_milestone_id UUID REFERENCES payment_milestones(id) ON DELETE SET NULL,
  refund_number VARCHAR(100) NOT NULL,
  refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  reference_number VARCHAR(100),
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'void')),
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(tenant_id, credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_project ON credit_notes(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_number ON refunds(tenant_id, refund_number);
CREATE INDEX IF NOT EXISTS idx_refunds_project ON refunds(project_id);
