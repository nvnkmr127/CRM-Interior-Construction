-- Migration: 116_snag_rework_tracking.sql
-- Description: Adds rework tracking columns to the snags table.

ALTER TABLE snags
ADD COLUMN IF NOT EXISTS rework_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rework_root_cause_category VARCHAR(100) CHECK (rework_root_cause_category IN ('workmanship_error', 'material_defect', 'design_flaw', 'site_damage', 'vendor_fault', 'other')),
ADD COLUMN IF NOT EXISTS rework_estimated_hours DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_actual_hours DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_cost DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_completed_at TIMESTAMP;
