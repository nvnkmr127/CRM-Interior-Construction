-- Migration: 081_boq_client_acceptance.sql
-- Description: Adds accepted_at column to quotations to record client confirmation date.

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
