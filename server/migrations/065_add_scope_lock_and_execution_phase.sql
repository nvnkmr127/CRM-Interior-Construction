-- Migration: 065_add_scope_lock_and_execution_phase.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_scope_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS is_execution BOOLEAN DEFAULT FALSE;

-- Update existing project_phases to mark execution phases
UPDATE project_phases 
SET is_execution = TRUE 
WHERE LOWER(name) NOT LIKE '%design%' 
  AND LOWER(name) NOT LIKE '%measurement%' 
  AND LOWER(name) NOT LIKE '%plan%' 
  AND LOWER(name) NOT LIKE '%draft%'
  AND LOWER(name) NOT LIKE '%concept%';
