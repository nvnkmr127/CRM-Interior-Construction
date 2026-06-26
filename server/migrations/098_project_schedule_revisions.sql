-- Migration: 098_project_schedule_revisions.sql
-- Description: Adds baseline date columns to projects and tasks, and creates project_schedule_revisions table.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_target_date DATE;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_due_date DATE;

-- If any active projects exist, populate their baselines with current start/target dates
UPDATE projects
SET baseline_start_date = start_date,
    baseline_target_date = target_date
WHERE status = 'active' AND baseline_start_date IS NULL;

-- Populate task baselines for active projects
UPDATE tasks t
SET baseline_start_date = t.start_date,
    baseline_due_date = t.due_date
FROM projects p
WHERE t.project_id = p.id AND p.status = 'active' AND t.baseline_start_date IS NULL;

CREATE TABLE IF NOT EXISTS project_schedule_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revised_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revised_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  previous_start_date DATE,
  previous_target_date DATE,
  new_start_date DATE,
  new_target_date DATE,
  reason TEXT NOT NULL,
  revision_number INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sched_rev_proj ON project_schedule_revisions(project_id);
