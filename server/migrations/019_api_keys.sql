CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the raw key
  key_prefix VARCHAR(8) NOT NULL,        -- first 8 chars for display e.g. 'crm_a1b2'
  scopes TEXT DEFAULT '["read"]',
  -- scopes options: 'read','write','admin','leads:read','leads:write',
  --                 'projects:read','projects:write','webhooks:manage'
  rate_limit_rpm INTEGER DEFAULT 60,
  ip_allowlist TEXT DEFAULT '[]',       -- empty = allow all IPs
  expires_at TEXT,
  last_used_at TEXT,
  last_used_ip VARCHAR(45),
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
