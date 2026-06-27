-- Migration: 105_change_order_module.sql
-- Description: Enhances project_change_orders table with reason, timeline impact, client signature, and updates status values.

-- 1. Add columns for reason, timeline_impact_days, client_signature, and client_signed_at
ALTER TABLE project_change_orders 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS timeline_impact_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_signature TEXT,
ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMP;

-- 2. Update existing rows where status is 'pending' to 'submitted'
UPDATE project_change_orders
SET status = 'submitted'
WHERE status = 'pending';

-- 3. Change default status to 'draft'
ALTER TABLE project_change_orders
ALTER COLUMN status SET DEFAULT 'draft';
