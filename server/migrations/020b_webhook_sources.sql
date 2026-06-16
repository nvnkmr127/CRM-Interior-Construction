CREATE TABLE IF NOT EXISTS webhook_sources (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  source_key VARCHAR(255) UNIQUE NOT NULL,
  secret VARCHAR(255),
  field_mapping TEXT DEFAULT '[]',
  dedup_field VARCHAR(100),
  default_stage_id TEXT REFERENCES lead_stages(id) ON DELETE SET NULL,
  default_assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  provider_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_sources_tenant ON webhook_sources(tenant_id);

CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_key VARCHAR(255),
  raw_payload TEXT,
  mapped_data TEXT,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  status VARCHAR(50),
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_tenant ON inbound_webhook_logs(tenant_id);
