-- Migration: 159_configurable_trade_activities.sql
-- Description: Adds tenant-configurable trade templates, activity dependencies, and photo completion evidence.

-- 1. Alter trade_activity_templates to add tenant support
ALTER TABLE trade_activity_templates
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trade_act_tpl_tenant ON trade_activity_templates(tenant_id);

-- 2. Create work activity dependencies table
CREATE TABLE IF NOT EXISTS work_activity_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  depends_on_activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'finish-to-start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_work_activity_dependency UNIQUE (activity_id, depends_on_activity_id),
  CONSTRAINT chk_activity_self_dependency CHECK (activity_id <> depends_on_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_work_act_dep_act ON work_activity_dependencies(activity_id);
CREATE INDEX IF NOT EXISTS idx_work_act_dep_depends ON work_activity_dependencies(depends_on_activity_id);
CREATE INDEX IF NOT EXISTS idx_work_act_dep_proj ON work_activity_dependencies(project_id);

-- 3. Create work activity photos completion evidence table
CREATE TABLE IF NOT EXISTS work_activity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  file_url VARCHAR(512) NOT NULL,
  caption VARCHAR(255),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_act_photos_act ON work_activity_photos(activity_id);
