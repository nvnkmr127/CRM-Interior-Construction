-- Migration: 103_add_client_fields_to_site_visits.sql
-- Description: Adds client_invited and client_feedback columns to site_visits table.

ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS client_invited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_feedback TEXT;
