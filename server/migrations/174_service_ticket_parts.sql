-- Migration: 174_service_ticket_parts.sql
-- Description: Creates service_ticket_parts table to track parts used during service ticket resolution.

CREATE TABLE IF NOT EXISTS service_ticket_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES service_visits(id) ON DELETE SET NULL,
  part_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  cost DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_tenant ON service_ticket_parts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_ticket ON service_ticket_parts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_visit ON service_ticket_parts(visit_id);
