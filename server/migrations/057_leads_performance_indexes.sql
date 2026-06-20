-- Migration: 057_leads_performance_indexes.sql

-- Add indexes for score and updated_at as they are frequently used in filtering and sorting
CREATE INDEX IF NOT EXISTS idx_leads_tenant_score ON leads(tenant_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_updated_at ON leads(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);
