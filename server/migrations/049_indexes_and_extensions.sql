-- Migration: 049_indexes_and_extensions.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Core performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at);

-- Fuzzy search indexes using pg_trgm
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);
