-- Migration: 161_site_issue_escalation.sql
-- Description: Adds blocked_at and escalation_level columns to tasks for the Site Issue Escalation Workflow.

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

-- Set escalation_level to 0 for any tasks where it might be null
UPDATE tasks SET escalation_level = 0 WHERE escalation_level IS NULL;

-- If a task is currently blocked, set blocked_at to updated_at as a fallback
UPDATE tasks SET blocked_at = updated_at WHERE status = 'blocked' AND blocked_at IS NULL;
