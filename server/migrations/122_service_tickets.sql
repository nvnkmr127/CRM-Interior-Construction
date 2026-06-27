-- Migration: 122_service_tickets.sql
-- Description: Creates service_tickets and service_visits tables for post-sales support ticket tracking.

CREATE TABLE IF NOT EXISTS service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_portal_user_id UUID REFERENCES client_portal_users(id) ON DELETE SET NULL,
  ticket_number VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- e.g., 'plumbing', 'electrical', 'carpentry', 'painting', 'masonry', 'appliances', 'other'
  priority VARCHAR(50) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'assigned', 'scheduled', 'resolved', 'closed'
  warranty_eligibility VARCHAR(50) NOT NULL DEFAULT 'checking', -- 'eligible', 'not_eligible', 'checking', 'chargeable'
  assigned_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_details TEXT,
  resolved_at TIMESTAMP,
  client_feedback_rating INT CHECK (client_feedback_rating BETWEEN 1 AND 5),
  client_feedback_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, ticket_number)
);

CREATE TABLE IF NOT EXISTS service_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  completed_date TIMESTAMP,
  engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visit_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_tickets_tenant ON service_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_project ON service_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_engineer ON service_tickets(assigned_engineer_id);

CREATE INDEX IF NOT EXISTS idx_service_visits_tenant ON service_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_ticket ON service_visits(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_scheduled ON service_visits(scheduled_date);
