-- Migration: 054_add_mfa_to_users.sql
-- Add MFA fields to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
