-- Migration: 158_project_site_visits.sql
-- Description: Enhances site_visits to support projects, agendas, and formal outcomes.

ALTER TABLE site_visits 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agenda TEXT,
  ADD COLUMN IF NOT EXISTS next_steps TEXT,
  ADD COLUMN IF NOT EXISTS client_acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_acknowledged_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_site_visits_project ON site_visits(project_id);

CREATE TABLE IF NOT EXISTS site_visit_linked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'task', 'snag'
  item_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sv_linked_items_visit ON site_visit_linked_items(site_visit_id);
