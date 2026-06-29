-- Migration: 140_client_household_profile.sql
-- Description: Add client household profile fields to projects and extend project contacts with contact preferences and approval authority levels.

-- 1. Add household columns to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS spouse_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spouse_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS number_of_family_members INTEGER,
  ADD COLUMN IF NOT EXISTS lifestyle_preferences TEXT,
  ADD COLUMN IF NOT EXISTS preferred_communication_channel VARCHAR(50);

-- 2. Add contact preferences and approval authority level columns to project_contacts table
ALTER TABLE project_contacts
  ADD COLUMN IF NOT EXISTS contact_preference VARCHAR(50),
  ADD COLUMN IF NOT EXISTS approval_authority_level VARCHAR(50);
