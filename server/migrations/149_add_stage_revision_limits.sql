-- Migration: 149_add_stage_revision_limits.sql
-- Description: Adds configuration for allowed revision limits and counts per design stage.

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS stage_revision_limits JSONB DEFAULT '{"Requirement Gathering": 3, "Concept Presentation": 3, "Concept Approval": 3, "Detailed Design": 3, "Client Review": 3, "Revision Rounds": 3, "Design Freeze": 3}'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_revision_counts JSONB DEFAULT '{"Requirement Gathering": 0, "Concept Presentation": 0, "Concept Approval": 0, "Detailed Design": 0, "Client Review": 0, "Revision Rounds": 0, "Design Freeze": 0}'::jsonb;

-- Populate existing rows where JSON is empty or null
UPDATE projects
SET 
  stage_revision_limits = jsonb_build_object(
    'Requirement Gathering', COALESCE(allowed_design_revisions, 3),
    'Concept Presentation', COALESCE(allowed_design_revisions, 3),
    'Concept Approval', COALESCE(allowed_design_revisions, 3),
    'Detailed Design', COALESCE(allowed_design_revisions, 3),
    'Client Review', COALESCE(allowed_design_revisions, 3),
    'Revision Rounds', COALESCE(allowed_design_revisions, 3),
    'Design Freeze', COALESCE(allowed_design_revisions, 3)
  ),
  stage_revision_counts = '{"Requirement Gathering": 0, "Concept Presentation": 0, "Concept Approval": 0, "Detailed Design": 0, "Client Review": 0, "Revision Rounds": 0, "Design Freeze": 0}'::jsonb
WHERE stage_revision_limits IS NULL OR stage_revision_limits = '{}'::jsonb;
