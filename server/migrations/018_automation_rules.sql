CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger TEXT NOT NULL,
  -- trigger: { type: 'record.created'|'field.changed'|'date.condition'|'webhook.received',
  --            entity: 'lead'|'project'|'task', config: {...} }
  conditions TEXT DEFAULT '[]',
  -- conditions: [{ field, operator, value, logic:'AND'|'OR' }]
  actions TEXT DEFAULT '[]',
  -- actions: [{ type: 'send_whatsapp'|'create_task'|'update_field'|
  --             'assign_user'|'call_webhook'|'send_email', config: {...} }]
  is_active BOOLEAN DEFAULT true,
  last_run_at TEXT,
  run_count INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automation_rules(tenant_id, is_active);
