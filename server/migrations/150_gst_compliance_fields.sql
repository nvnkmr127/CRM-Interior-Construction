-- Migration: 150_gst_compliance_fields.sql
-- Description: Adds GST compliance fields for Works Contract / Composite Supply and HSN/SAC codes.

-- 1. Add fields to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply')),
ADD COLUMN IF NOT EXISTS works_contract_rate DECIMAL(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS works_contract_hsn VARCHAR(50) DEFAULT '9954';

-- 2. Add fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply'));

-- 3. Add fields to credit_notes table
ALTER TABLE credit_notes
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply'));
