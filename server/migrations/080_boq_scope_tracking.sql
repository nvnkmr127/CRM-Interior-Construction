-- Migration: 080_boq_scope_tracking.sql
-- Description: Adds scope tracking columns (scope_type, change_order_id) to quotation_items.

ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) DEFAULT 'original' NOT NULL CHECK (scope_type IN ('original', 'addition', 'reduction')),
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES project_change_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotation_items_change_order ON quotation_items(change_order_id);
