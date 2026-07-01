-- Add fields for formal project pause and resume workflow
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS resource_release_instructions TEXT,
ADD COLUMN IF NOT EXISTS site_security_plan TEXT;
