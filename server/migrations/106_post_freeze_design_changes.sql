-- Migration: 106_post_freeze_design_changes.sql
-- Description: Adds specific impact fields for post-freeze design changes to change orders.

ALTER TABLE project_change_orders
ADD COLUMN IF NOT EXISTS design_cost NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_impact TEXT,
ADD COLUMN IF NOT EXISTS procurement_impact TEXT;
