CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),               -- used for HMAC-SHA256 signing
  events TEXT DEFAULT '[]',         -- e.g. ['lead.created','project.phase_completed']
  custom_headers TEXT DEFAULT '{}',
  payload_template TEXT,            -- optional custom payload shape
  retry_count INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload TEXT,
  status_code INTEGER,
  response_body TEXT,
  latency_ms INTEGER,
  attempt_number BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id, created_at DESC);
