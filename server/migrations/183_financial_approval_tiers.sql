-- Migration: 183_financial_approval_tiers.sql
-- Description: Add required_authority_level to financial approvals and allow change_order transaction_type

-- Add required_authority_level column
ALTER TABLE financial_approvals 
ADD COLUMN IF NOT EXISTS required_authority_level VARCHAR(50) DEFAULT 'level_1';

-- Update check constraints for transaction_type
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
          AND t.relname = 'financial_approvals'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%transaction_type%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE financial_approvals 
ADD CONSTRAINT financial_approvals_transaction_type_check 
CHECK (transaction_type IN ('invoice', 'payment', 'payment_update', 'discount', 'credit', 'refund', 'change_order'));

-- Allow change_orders to have a pending_approval status
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
          AND t.relname = 'change_orders'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE change_orders 
ADD CONSTRAINT change_orders_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'executed', 'cancelled'));
