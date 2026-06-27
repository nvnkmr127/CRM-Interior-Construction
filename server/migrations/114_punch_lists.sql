-- Migration: 114_punch_lists.sql
-- Description: Creates punch_lists and punch_list_items tables for pre-handover walkthroughs.

CREATE TABLE IF NOT EXISTS punch_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  walkthrough_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'resolved', 'client_verified')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_off_by_client BOOLEAN DEFAULT false,
  client_signed_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id UUID NOT NULL REFERENCES punch_lists(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  trade VARCHAR(50) NOT NULL, -- carpentry, painting, electrical, plumbing, flooring, etc.
  item_description TEXT NOT NULL,
  photo_key VARCHAR(255),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'verified')),
  closed_by_qc UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP,
  qc_notes TEXT,
  client_verified BOOLEAN DEFAULT false,
  client_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_punch_lists_project ON punch_lists(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_punch_list_items_list ON punch_list_items(punch_list_id);
