-- Migration: 096_room_completion_tracking.sql
-- Description: Adds room_name column to the tasks table for room-wise completion tracking.

-- 1. Add room_name column to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS room_name VARCHAR(100);

-- 2. Create index for performance on room-wise lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project_room ON tasks(project_id, room_name);
