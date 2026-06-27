-- Migration: 131_material_discontinuation_and_room_handovers.sql
-- Description: Adds material discontinuation flag in BOQ items and creates room-level handover table.

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS is_discontinued BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS project_room_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, signed_off
  signed_off_at TIMESTAMP,
  signed_off_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_otp_verified BOOLEAN DEFAULT false,
  client_name VARCHAR(255),
  client_signature_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, room_name)
);

CREATE INDEX IF NOT EXISTS idx_project_room_handovers_project ON project_room_handovers(project_id);
