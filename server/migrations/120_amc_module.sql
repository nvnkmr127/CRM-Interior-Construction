-- Migration: 120_amc_module.sql
-- Description: Creates the amcs and amc_visits tables for Annual Maintenance Contract tracking.

CREATE TABLE IF NOT EXISTS amcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_number VARCHAR(100) NOT NULL,
  contract_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  covered_scope TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'renewed', 'cancelled'
  auto_renewal_alert_days INT DEFAULT 30,
  renewal_alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, contract_number)
);

CREATE TABLE IF NOT EXISTS amc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amc_id UUID NOT NULL REFERENCES amcs(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'missed', 'cancelled'
  completed_date DATE,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_amcs_tenant ON amcs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_amcs_project ON amcs(project_id);
CREATE INDEX IF NOT EXISTS idx_amcs_status ON amcs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_amc_visits_tenant ON amc_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_amc_visits_amc ON amc_visits(amc_id);
CREATE INDEX IF NOT EXISTS idx_amc_visits_scheduled ON amc_visits(scheduled_date);
