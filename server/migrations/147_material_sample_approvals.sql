-- Migration: 147_material_sample_approvals.sql
-- Description: Adds sample category, presentation date, client decision, signature, and BOQ item link to project_material_palettes.

ALTER TABLE project_material_palettes
  ADD COLUMN IF NOT EXISTS sample_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_presented DATE,
  ADD COLUMN IF NOT EXISTS client_decision VARCHAR(50) DEFAULT 'deferred', -- approved, rejected, deferred
  ADD COLUMN IF NOT EXISTS approved_by_signature VARCHAR(255),
  ADD COLUMN IF NOT EXISTS boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_material_palettes_boq ON project_material_palettes(boq_item_id);
