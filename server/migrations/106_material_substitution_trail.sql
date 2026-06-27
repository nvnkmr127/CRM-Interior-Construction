-- Migration: 106_material_substitution_trail.sql
-- Description: Adds original specifications and client sign-off fields to material_substitutions table.

ALTER TABLE material_substitutions
  ADD COLUMN IF NOT EXISTS original_item_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS original_brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS original_material_specifications TEXT,
  ADD COLUMN IF NOT EXISTS original_unit_price DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS client_signoff_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT;
