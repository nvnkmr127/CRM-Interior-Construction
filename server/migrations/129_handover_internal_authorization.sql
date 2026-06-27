-- Migration: 129_handover_internal_authorization.sql
-- Description: Adds internal authorization fields to handover checklists.

ALTER TABLE handover_checklists
  ADD COLUMN IF NOT EXISTS is_internally_authorized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS internally_authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internally_authorized_at TIMESTAMP;
