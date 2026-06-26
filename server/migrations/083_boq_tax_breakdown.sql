-- Migration: 083_boq_tax_breakdown.sql
-- Description: Adds GST breakdown columns to quotations and quotation_items.

-- 1. Add GST type and totals to quotations
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
ADD COLUMN IF NOT EXISTS cgst_total DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_total DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS igst_total DECIMAL(12,2) DEFAULT 0.00;

-- 2. Add HSN, GST rate, and split columns to quotation_items
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(12,2) DEFAULT 0.00;
