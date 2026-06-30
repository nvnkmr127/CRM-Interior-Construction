-- Migration: 176_service_ticket_repeat_complaints.sql
-- Description: Adds affected_item and is_repeat_complaint fields to service_tickets for repeat complaint detection.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS affected_item VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_repeat_complaint BOOLEAN DEFAULT false;
