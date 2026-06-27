-- Migration: 124_service_visits_scheduling.sql
-- Description: Adds client confirmation, reminder tracking, and outcome to service_visits.

ALTER TABLE service_visits
  ADD COLUMN IF NOT EXISTS client_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visit_outcome VARCHAR(255);
