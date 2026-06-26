-- Migration: 099_add_resource_workload_fields.sql
-- Description: Adds weekly_capacity to users and pm/designer hours allocations to projects

-- Add weekly_capacity to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_capacity INTEGER DEFAULT 40;

-- Add pm_hours_allocated and designer_hours_allocated to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_hours_allocated INTEGER DEFAULT 10;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS designer_hours_allocated INTEGER DEFAULT 20;
