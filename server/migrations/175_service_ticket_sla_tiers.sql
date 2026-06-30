-- Migration: 175_service_ticket_sla_tiers.sql
-- Description: Adds distinct First Response and Resolution SLAs for service tickets.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS first_response_sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS first_response_due_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolution_due_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMP;

-- Backfill existing data to map old sla_hours to resolution_sla_hours
UPDATE service_tickets
SET 
  resolution_sla_hours = COALESCE(sla_hours, CASE 
    WHEN priority = 'critical' THEN 24
    WHEN priority = 'high' THEN 72
    WHEN priority = 'medium' THEN 168
    WHEN priority = 'low' THEN 168
    ELSE 168
  END),
  resolution_due_date = COALESCE(due_date, created_at + ((COALESCE(sla_hours, 168)) || ' hours')::INTERVAL),
  first_response_sla_hours = CASE
    WHEN priority = 'critical' THEN 4
    WHEN priority = 'high' THEN 24
    WHEN priority = 'medium' THEN 72
    WHEN priority = 'low' THEN 72
    ELSE 72
  END
WHERE resolution_sla_hours IS NULL;

UPDATE service_tickets
SET 
  first_response_due_date = created_at + (first_response_sla_hours || ' hours')::INTERVAL
WHERE first_response_due_date IS NULL;

-- Automatically set first_responded_at for tickets that are no longer 'open'
UPDATE service_tickets
SET first_responded_at = updated_at
WHERE status != 'open' AND first_responded_at IS NULL;
