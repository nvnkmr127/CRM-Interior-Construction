-- Phase 1: Lead Qualification Expansion
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS builder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS possession_date DATE,
  ADD COLUMN IF NOT EXISTS house_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS loan_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interior_style VARCHAR(100),
  ADD COLUMN IF NOT EXISTS material_preference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS preferred_communication VARCHAR(50),
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50),
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lifestyle_preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB DEFAULT '[]'::jsonb;
