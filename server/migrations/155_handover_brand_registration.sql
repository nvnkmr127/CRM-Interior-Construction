-- Migration: 155_handover_brand_registration.sql
-- Description: Adds column for brand registration card tracking to handover items

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS has_brand_registration_card BOOLEAN DEFAULT false;
