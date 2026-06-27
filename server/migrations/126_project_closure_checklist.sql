-- Migration: 126_project_closure_checklist.sql
-- Description: Create project_closure_checklists table to verify project closure gates.

CREATE TABLE IF NOT EXISTS project_closure_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  financial_clearance_completed BOOLEAN DEFAULT false,
  financial_clearance_notes TEXT,
  financial_clearance_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  financial_clearance_verified_at TIMESTAMP,
  
  task_completion_completed BOOLEAN DEFAULT false,
  task_completion_notes TEXT,
  task_completion_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  task_completion_verified_at TIMESTAMP,
  
  snag_closure_completed BOOLEAN DEFAULT false,
  snag_closure_notes TEXT,
  snag_closure_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  snag_closure_verified_at TIMESTAMP,
  
  document_archive_completed BOOLEAN DEFAULT false,
  document_archive_notes TEXT,
  document_archive_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  document_archive_verified_at TIMESTAMP,
  
  warranty_activation_completed BOOLEAN DEFAULT false,
  warranty_activation_notes TEXT,
  warranty_activation_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  warranty_activation_verified_at TIMESTAMP,
  
  status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_closure_tenant ON project_closure_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_closure_project ON project_closure_checklists(project_id);
