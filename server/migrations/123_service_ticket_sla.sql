-- Migration: 123_service_ticket_sla.sql
-- Description: Adds SLA support (sla_hours and due_date) to service_tickets.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- Backfill existing tickets
UPDATE service_tickets
SET sla_hours = CASE 
  WHEN priority = 'critical' THEN 4
  WHEN priority = 'high' THEN 24
  WHEN priority = 'medium' THEN 72
  WHEN priority = 'low' THEN 168
  ELSE 72
END
WHERE sla_hours IS NULL;

UPDATE service_tickets
SET due_date = created_at + (sla_hours || ' hours')::INTERVAL
WHERE due_date IS NULL;
