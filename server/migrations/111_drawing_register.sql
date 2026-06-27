-- Migration: 111_drawing_register.sql
-- Description: Adds drawing_register table to track drawings, versions, revisions, issue dates, and status.

CREATE TABLE IF NOT EXISTS drawing_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number VARCHAR(100) NOT NULL,
  revision_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'issued_for_approval', 'issued_for_construction', 'superseded', 'issued_for_info'
  issued_date DATE NOT NULL,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_superseded BOOLEAN DEFAULT FALSE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id, drawing_number, revision_code)
);

CREATE INDEX IF NOT EXISTS idx_drawing_reg_project ON drawing_register(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_reg_number ON drawing_register(drawing_number);
