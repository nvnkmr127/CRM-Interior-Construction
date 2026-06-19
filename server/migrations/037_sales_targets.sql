-- Migration: 037_sales_targets.sql

CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_month DATE NOT NULL, -- e.g., '2026-06-01'
  target_revenue NUMERIC(15, 2) DEFAULT 0,
  target_leads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, user_id, target_month)
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_user ON sales_targets(user_id);
