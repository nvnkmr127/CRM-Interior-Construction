-- Migration: 117_handover_documentation.sql
-- Description: Adds columns to handover_items to track product manuals and warranties.

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'inspection',
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS has_manual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_warranty_card BOOLEAN DEFAULT false;
