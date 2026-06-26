-- Migration: 070_add_project_contacts.sql
CREATE TABLE IF NOT EXISTS project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  role VARCHAR(100),               -- e.g., 'co_owner', 'spouse', 'architect', 'builder_representative', 'legal'
  decision_authority VARCHAR(50),  -- e.g., 'Primary', 'Influencer', 'Consultant'
  relationship_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
