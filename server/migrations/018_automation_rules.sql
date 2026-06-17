CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
  run_count BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automation_rules(tenant_id, is_active);
