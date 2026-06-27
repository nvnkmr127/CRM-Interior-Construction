-- Migration: 128_financial_approvals.sql
-- Description: Create financial_approvals table and update status check constraints on invoices, credit_notes, and refunds.

CREATE TABLE IF NOT EXISTS financial_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'payment_update', 'discount', 'credit', 'refund')),
  target_id UUID NOT NULL, -- references invoices(id), payment_milestones(id), quotations(id), credit_notes(id), or refunds(id)
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_changes JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  threshold_limit DECIMAL(12,2),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_approvals_tenant ON financial_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_approvals_status ON financial_approvals(tenant_id, status);

-- Alter check constraint on invoices, credit_notes, and refunds to allow 'pending_approval' status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.conname, t.relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname IN ('invoices', 'credit_notes', 'refunds')
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'void', 'pending_approval'));
ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_status_check CHECK (status IN ('issued', 'void', 'pending_approval'));
ALTER TABLE refunds ADD CONSTRAINT refunds_status_check CHECK (status IN ('processed', 'failed', 'void', 'pending_approval'));
