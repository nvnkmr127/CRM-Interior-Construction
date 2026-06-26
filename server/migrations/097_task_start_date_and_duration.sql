-- Migration: 097_task_start_date_and_duration.sql
-- Description: Adds start_date and duration_days columns to the tasks table for task scheduling.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 1;

-- Backfill: Set start_date = COALESCE(due_date, project's start_date, CURRENT_DATE)
UPDATE tasks t
SET start_date = COALESCE(t.due_date, p.start_date, CURRENT_DATE)
FROM projects p
WHERE t.project_id = p.id AND t.start_date IS NULL;

-- Backfill tasks not associated with a project (e.g. lead tasks)
UPDATE tasks
SET start_date = COALESCE(due_date, CURRENT_DATE)
WHERE start_date IS NULL;

-- Backfill: Ensure due_date is at least start_date
UPDATE tasks
SET due_date = start_date
WHERE due_date IS NULL OR due_date < start_date;

-- Backfill: Set duration_days based on dates
UPDATE tasks
SET duration_days = GREATEST(1, due_date - start_date + 1)
WHERE start_date IS NOT NULL AND due_date IS NOT NULL;
