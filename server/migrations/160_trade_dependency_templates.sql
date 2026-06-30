-- Migration: 160_trade_dependency_templates.sql
-- Description: Adds trade_dependency_templates table for pre-configured standard trade sequences.

CREATE TABLE IF NOT EXISTS trade_dependency_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  trade VARCHAR(100) NOT NULL,
  depends_on_trade VARCHAR(100) NOT NULL,
  dependency_type VARCHAR(50) DEFAULT 'finish-to-start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_trade_dependency_template UNIQUE NULLS NOT DISTINCT (tenant_id, trade, depends_on_trade)
);

CREATE INDEX IF NOT EXISTS idx_trade_dep_tpl_tenant ON trade_dependency_templates(tenant_id);

-- Insert standard industry sequences as defaults for all tenants (tenant_id IS NULL)
INSERT INTO trade_dependency_templates (trade, depends_on_trade) VALUES
  ('plumbing', 'civil'),
  ('electrical', 'civil'),
  ('false_ceiling', 'civil'),
  ('false_ceiling', 'electrical'),
  ('flooring', 'civil'),
  ('flooring', 'plumbing'),
  ('flooring', 'electrical'),
  ('painting', 'civil'),
  ('painting', 'false_ceiling'),
  ('carpentry', 'flooring'),
  ('glass', 'flooring'),
  ('soft_furnishing', 'carpentry'),
  ('soft_furnishing', 'painting')
ON CONFLICT DO NOTHING;
