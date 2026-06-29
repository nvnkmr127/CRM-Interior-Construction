-- Migration: 143_project_site_access.sql
-- Description: Add site access columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS key_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS key_holder_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spare_key_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gate_pass_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS access_card_holder VARCHAR(255),
  ADD COLUMN IF NOT EXISTS access_time_restrictions VARCHAR(255);
