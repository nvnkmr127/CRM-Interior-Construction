-- Migration: 132_warranty_repeats_and_budget_alerts.sql
-- Description: Adds columns to support repeat warranty claim flagging and budget alert tracking.

ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS is_repeat_claim BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repeat_claim_count INTEGER DEFAULT 0;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS alert_80_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_90_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_100_sent BOOLEAN DEFAULT FALSE;
