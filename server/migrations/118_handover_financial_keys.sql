-- Migration: 118_handover_financial_keys.sql
-- Description: Adds columns to payment_milestones and handover_items for financial clearance and key handover.

ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS is_deferred BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deferral_reference VARCHAR(255);

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS key_details VARCHAR(255);
