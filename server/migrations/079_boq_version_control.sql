-- Migration: 079_boq_version_control.sql
-- Description: Adds change_reason column to quotations and item_key column to quotation_items for comparison tracking.

-- 1. Add change_reason to quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- 2. Add item_key to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS item_key UUID DEFAULT gen_random_uuid();

-- 3. Backfill item_key for any existing rows that might be NULL
UPDATE quotation_items 
SET item_key = gen_random_uuid() 
WHERE item_key IS NULL;
