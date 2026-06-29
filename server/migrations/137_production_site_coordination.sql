-- Migration: 137_production_site_coordination.sql
-- Description: Adds site_readiness_date to projects table for production-site coordination.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_readiness_date DATE;
