CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),               -- used for HMAC-SHA256 signing
  events TEXT DEFAULT '[]',         -- e.g. ['lead.created','project.phase_completed']
  custom_headers TEXT DEFAULT '{}',
  payload_template TEXT,            -- optional custom payload shape
  retry_count INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  webhook_id TEXT REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload TEXT,
  status_code INTEGER,
  response_body TEXT,
  latency_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id, created_at DESC);
