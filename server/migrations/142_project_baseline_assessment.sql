-- Migration: 142_project_baseline_assessment.sql
-- Description: Create project site condition baseline assessment tables

CREATE TABLE IF NOT EXISTS project_baseline_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  overall_notes TEXT,
  video_walkthrough_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_baseline UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS project_baseline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES project_baseline_assessments(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  area_checked VARCHAR(100) NOT NULL, -- e.g. 'walls', 'flooring', 'electrical', 'plumbing', 'civil'
  condition_status VARCHAR(50) DEFAULT 'ok', -- ok, damaged, defect, n_a
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb, -- array of photo URLs or objects { url, caption }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proj_baseline_ass_proj ON project_baseline_assessments(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_proj_baseline_item_ass ON project_baseline_items(assessment_id, tenant_id);
