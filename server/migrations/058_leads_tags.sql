-- Migration: 058_leads_tags.sql

ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING gin (tags);
