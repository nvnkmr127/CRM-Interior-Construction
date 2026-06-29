-- Migration: 138_handover_readiness_by_gate.sql
-- Description: Creates handover_readiness_gates and handover_appointments tables.

CREATE TABLE IF NOT EXISTS handover_readiness_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pm_signed_off BOOLEAN DEFAULT FALSE,
  pm_signed_off_by UUID REFERENCES users(id) ON DELETE SET NULL,
  pm_signed_off_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handover_readiness_gates_project ON handover_readiness_gates(project_id);
CREATE INDEX IF NOT EXISTS idx_handover_appointments_project ON handover_appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_handover_appointments_date ON handover_appointments(appointment_date);
