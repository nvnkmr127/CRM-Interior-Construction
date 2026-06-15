CREATE TABLE IF NOT EXISTS webhook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  source_key VARCHAR(255) UNIQUE NOT NULL,
  secret VARCHAR(255),
  field_mapping JSONB DEFAULT '[]',
  dedup_field VARCHAR(100),
  default_stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL,
  default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_sources_tenant ON webhook_sources(tenant_id);

CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_key VARCHAR(255),
  raw_payload JSONB,
  mapped_data JSONB,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status VARCHAR(50),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_tenant ON inbound_webhook_logs(tenant_id);
