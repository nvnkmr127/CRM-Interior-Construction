-- Migration: 157_production_qc_checklist_column.sql
-- Description: Adds a checklist column to production_qc_inspections to support structured item-wise acceptance criteria checklist.

ALTER TABLE production_qc_inspections
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';
