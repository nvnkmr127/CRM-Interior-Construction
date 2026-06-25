-- Migration: 067_add_payment_terms_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50);
