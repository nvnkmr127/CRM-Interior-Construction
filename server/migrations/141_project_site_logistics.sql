-- Migration: 141_project_site_logistics.sql
-- Description: Add site logistics columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lift_availability VARCHAR(50),
  ADD COLUMN IF NOT EXISTS lift_dimensions VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staircase_access VARCHAR(100),
  ADD COLUMN IF NOT EXISTS working_hour_window VARCHAR(100),
  ADD COLUMN IF NOT EXISTS society_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS parking_permission VARCHAR(100),
  ADD COLUMN IF NOT EXISTS unloading_area VARCHAR(255),
  ADD COLUMN IF NOT EXISTS noc_requirements TEXT;
