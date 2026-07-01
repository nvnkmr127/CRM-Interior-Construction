-- Migration 185_payment_default_escalation.sql
-- Description: Adds payment_escalations table to track structured responses to payment defaults.

CREATE TABLE IF NOT EXISTS payment_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_milestone_id UUID NOT NULL REFERENCES payment_milestones(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  escalation_level VARCHAR(50) NOT NULL, -- e.g. '15_days_alert', '30_days_hold', '45_days_legal', '60_days_lockout'
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_communication_sent BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active', -- 'active' or 'resolved'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_escalations_milestone ON payment_escalations(payment_milestone_id);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_project ON payment_escalations(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_tenant ON payment_escalations(tenant_id);

-- Add financial_status column to projects if we want to explicitly track financial holds
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='financial_status') THEN
        ALTER TABLE projects ADD COLUMN financial_status VARCHAR(50) DEFAULT 'clear';
    END IF;
END $$;
