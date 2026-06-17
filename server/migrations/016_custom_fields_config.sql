CREATE TABLE IF NOT EXISTS custom_fields_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity VARCHAR(50) NOT NULL,   -- 'lead','project','task','contact'
  name VARCHAR(100) NOT NULL,    -- internal key e.g. 'budget_range'
  label VARCHAR(200) NOT NULL,   -- display label e.g. 'Budget Range'
  field_type VARCHAR(50) NOT NULL, -- 'text','number','date','dropdown','multi_select','file','boolean'
  options TEXT DEFAULT '[]',    -- for dropdown/multi_select
  is_required BOOLEAN DEFAULT false,
  visible_to_roles TEXT DEFAULT '["all"]',
  sort_order BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_tenant_entity_name
  ON custom_fields_config(tenant_id, entity, name);
CREATE INDEX IF NOT EXISTS idx_cf_tenant_entity
  ON custom_fields_config(tenant_id, entity);
