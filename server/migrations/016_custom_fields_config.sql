CREATE TABLE IF NOT EXISTS custom_fields_config (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity VARCHAR(50) NOT NULL,   -- 'lead','project','task','contact'
  name VARCHAR(100) NOT NULL,    -- internal key e.g. 'budget_range'
  label VARCHAR(200) NOT NULL,   -- display label e.g. 'Budget Range'
  field_type VARCHAR(50) NOT NULL, -- 'text','number','date','dropdown','multi_select','file','boolean'
  options TEXT DEFAULT '[]',    -- for dropdown/multi_select
  is_required BOOLEAN DEFAULT false,
  visible_to_roles TEXT DEFAULT '["all"]',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_tenant_entity_name
  ON custom_fields_config(tenant_id, entity, name);
CREATE INDEX IF NOT EXISTS idx_cf_tenant_entity
  ON custom_fields_config(tenant_id, entity);
