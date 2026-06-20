-- Migration: 060_partners.sql

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- e.g., 'Contractor', 'Architect', 'Material Supplier'
  name VARCHAR(255) NOT NULL,
  rating NUMERIC(3, 1) DEFAULT 0.0,
  completed_projects INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_tenant ON marketplace_partners(tenant_id);
