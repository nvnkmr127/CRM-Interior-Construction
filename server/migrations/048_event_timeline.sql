-- Migration: 048_event_timeline.sql

CREATE TABLE IF NOT EXISTS lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id UUID,
  summary TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_lead ON lead_timeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tenant_date ON lead_timeline(tenant_id, created_at DESC);
