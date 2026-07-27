-- Migration: 024_user_permissions.sql
-- Description: Add direct and temporary permissions to users table.

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS direct_permissions JSONB DEFAULT '[]'::jsonb;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS temporary_permissions JSONB DEFAULT '[]'::jsonb;
