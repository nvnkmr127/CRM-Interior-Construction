-- Migration: 130_project_pause_and_cancellation.sql
-- Description: Adds columns for project pause/hold and cancellation workflows.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS expected_resume_date DATE,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_amount_refunded DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_amount_recovered DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS settlement_notes TEXT,
  ADD COLUMN IF NOT EXISTS settlement_document_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS cancellation_client_acknowledged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancellation_client_acknowledged_at TIMESTAMP;

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
