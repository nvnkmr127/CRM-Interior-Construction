-- Migration: 139_customer_retention_scheduling.sql
-- Description: Creates the customer_retention_schedules table for tracking post-handover check-ins.

CREATE TABLE IF NOT EXISTS customer_retention_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL, -- '30_day', '90_day', '180_day', '365_day'
  scheduled_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'deferred', 'cancelled'
  actual_date DATE,
  feedback TEXT,
  csat_score INT CHECK (csat_score BETWEEN 1 AND 5),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_retention_project ON customer_retention_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_retention_status ON customer_retention_schedules(status);
CREATE INDEX IF NOT EXISTS idx_retention_scheduled ON customer_retention_schedules(scheduled_date);
