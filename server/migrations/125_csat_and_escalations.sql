-- Migration: 125_csat_and_escalations.sql
-- Description: Adds client satisfaction surveys (CSAT) and ticket escalations support.

-- Add escalation_level to service_tickets
ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

-- Create csat_feedback table
CREATE TABLE IF NOT EXISTS csat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL, -- 'handover', 'service_visit'
  reference_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comments TEXT,
  pm_id UUID REFERENCES users(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_ticket_escalations table
CREATE TABLE IF NOT EXISTS service_ticket_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  escalated_to_role VARCHAR(50) NOT NULL, -- 'pm', 'director'
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  reason VARCHAR(255),
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_csat_project ON csat_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_csat_pm ON csat_feedback(pm_id);
CREATE INDEX IF NOT EXISTS idx_csat_designer ON csat_feedback(designer_id);

CREATE INDEX IF NOT EXISTS idx_ticket_escalations_ticket ON service_ticket_escalations(ticket_id);
