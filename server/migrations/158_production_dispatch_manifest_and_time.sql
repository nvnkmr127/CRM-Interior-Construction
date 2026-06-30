-- Migration: 158_production_dispatch_manifest_and_time.sql
-- Description: Adds a manifest column to production_dispatches to support detailed material shipping list.

ALTER TABLE production_dispatches
ADD COLUMN IF NOT EXISTS manifest JSONB DEFAULT '[]';
