-- Migration: 034_sla_automation.sql

-- Add stage_updated_at to leads to track how long they have been in the current stage
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Set stage_updated_at to updated_at for existing leads as a fallback
UPDATE leads
SET stage_updated_at = updated_at
WHERE stage_updated_at IS NULL;

-- Add SLA fields to lead_stages to define the target SLA for each stage
ALTER TABLE lead_stages
ADD COLUMN IF NOT EXISTS max_days_in_stage INTEGER DEFAULT 3;
