
-- Migration: 184_vendor_default_handling.sql
-- Description: Add fields to project_vendors to track vendor defaults and financial recovery

ALTER TABLE project_vendors
  ADD COLUMN IF NOT EXISTS default_date DATE,
  ADD COLUMN IF NOT EXISTS work_completed_assessment TEXT,
  ADD COLUMN IF NOT EXISTS outstanding_scope TEXT,
  ADD COLUMN IF NOT EXISTS replacement_vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_recovery_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS financial_recovery_status VARCHAR(50) DEFAULT 'pending';

-- Optional: Create an index for quick lookup of defaulted vendors
CREATE INDEX IF NOT EXISTS idx_project_vendors_default_date ON project_vendors(default_date) WHERE default_date IS NOT NULL;

