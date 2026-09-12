-- Migration 031: Update status constraint on financial_approvals to include 'withdrawn' and 'cancelled'
ALTER TABLE financial_approvals DROP CONSTRAINT IF EXISTS financial_approvals_status_check;
ALTER TABLE financial_approvals ADD CONSTRAINT financial_approvals_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled'));
