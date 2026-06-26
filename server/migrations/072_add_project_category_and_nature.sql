-- Migration: 072_add_project_category_and_nature.sql
-- Description: Adds classification fields for project category, sub-category, property type, property age, renovation scope, and segment.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS project_sub_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS property_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS property_age VARCHAR(50),
ADD COLUMN IF NOT EXISTS renovation_scope VARCHAR(100),
ADD COLUMN IF NOT EXISTS segment VARCHAR(50);
