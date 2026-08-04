-- Migration: 029_leave_management_fields.sql
-- Description: Add fields for comprehensive leave management.

ALTER TABLE user_leaves 
ADD COLUMN IF NOT EXISTS leave_type VARCHAR(50) DEFAULT 'Annual Leave',
ADD COLUMN IF NOT EXISTS duration_type VARCHAR(50) DEFAULT 'Full Day',
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);
