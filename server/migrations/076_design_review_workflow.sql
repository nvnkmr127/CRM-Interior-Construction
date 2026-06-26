-- Migration: 076_design_review_workflow.sql
-- Description: Adds schema for structured 2D/3D design reviews including named rounds, item-level client comments, and round tracking.

CREATE TABLE IF NOT EXISTS design_review_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'Round 1', 'Round 2', 'Final', etc.
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed'
  decision_note TEXT,
  client_reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_review_rounds_project ON design_review_rounds(project_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS design_review_round_id UUID REFERENCES design_review_rounds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_docs_review_round ON documents(design_review_round_id);

CREATE TABLE IF NOT EXISTS design_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by_client BOOLEAN DEFAULT FALSE,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_item_comments_doc ON design_item_comments(document_id);
