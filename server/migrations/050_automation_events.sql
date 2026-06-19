-- Migration: 050_automation_events.sql

CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  workflow VARCHAR(255),
  trigger_type VARCHAR(100),
  action_type VARCHAR(100),
  status VARCHAR(50),
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_automation_events_lead ON automation_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_tenant_date ON automation_events(tenant_id, executed_at DESC);
