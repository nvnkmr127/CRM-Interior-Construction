-- Migration: 066_add_client_agreement_signoff_fields.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signed_by VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signature_method VARCHAR(50);
