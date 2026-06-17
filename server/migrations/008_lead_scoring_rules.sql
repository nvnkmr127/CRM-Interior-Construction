CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  field VARCHAR(100) NOT NULL,       -- 'source','custom_fields.budget','phone'
  operator VARCHAR(50) NOT NULL,     -- 'eq','neq','contains','is_not_empty'
  value TEXT,
  weight INTEGER NOT NULL DEFAULT 10,-- positive or negative
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scoring_tenant ON lead_scoring_rules(tenant_id, is_active);

-- Seed default scoring rules for demo tenant
INSERT INTO lead_scoring_rules (tenant_id, name, field, operator, value, weight) VALUES
  ((SELECT id FROM tenants WHERE slug='demo'), 'Facebook Source', 'source', 'eq', 'facebook', 5),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Indimart Source', 'source', 'eq', 'indimart', 10),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Referral Source', 'source', 'eq', 'referral', 20),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Phone Number Provided', 'phone', 'is_not_empty', NULL, 15),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Budget over 10L', 'custom_fields.budget', 'contains', '>10L', 25);
