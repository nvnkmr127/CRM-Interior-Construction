-- Migration: 177_service_ticket_chargeable_estimates.sql
-- Description: Adds chargeable_estimate, chargeable_estimate_status, and chargeable_estimate_approved_at to service_tickets

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS chargeable_estimate NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS chargeable_estimate_status VARCHAR(50), -- 'pending_approval', 'approved', 'rejected'
  ADD COLUMN IF NOT EXISTS chargeable_estimate_approved_at TIMESTAMP;
