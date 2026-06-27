-- Migration: 113_pre_installation_checklists.sql
-- Description: Adds qc_checklist column to project_work_activities for trade-wise checklists.

ALTER TABLE project_work_activities
ADD COLUMN IF NOT EXISTS qc_checklist JSONB DEFAULT '[]';
