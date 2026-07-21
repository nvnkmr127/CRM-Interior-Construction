-- 013_lead_forms_v2.sql

ALTER TABLE lead_forms
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Migrate existing data into settings column if needed
UPDATE lead_forms 
SET settings = jsonb_build_object(
  'success_message', success_message,
  'redirect_url', redirect_url
)
WHERE settings = '{}';
