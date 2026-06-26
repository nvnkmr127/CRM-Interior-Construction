-- Migration: 069_add_builder_society_info_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS builder_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS society_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rera_id VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS noc_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS occupancy_certificate_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_handover_date DATE;
