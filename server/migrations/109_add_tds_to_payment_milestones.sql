-- Migration: 109_add_tds_to_payment_milestones.sql
-- Description: Add tds_rate and tds_amount columns to payment_milestones table.

ALTER TABLE payment_milestones 
  ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12,2) DEFAULT 0.00;
