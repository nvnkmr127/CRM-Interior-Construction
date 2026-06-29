-- Migration: 151_labor_cost_estimation.sql
-- Description: Adds labor trade and estimation fields to quotations and quotation items

-- 1. Add labor subtotal tracking columns to quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS material_subtotal NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_subtotal NUMERIC(15,2) DEFAULT 0;

-- 2. Add trade and rate tracking columns to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS labor_trade VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS labor_rate_type VARCHAR(50) DEFAULT 'rate_per_unit',
ADD COLUMN IF NOT EXISTS labor_unit_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_markup_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_total_price NUMERIC(15,2) DEFAULT 0;

-- 3. Backfill existing quotations' material_subtotal with their current subtotal
UPDATE quotations 
SET material_subtotal = COALESCE(subtotal, 0)
WHERE material_subtotal = 0 AND subtotal > 0;
