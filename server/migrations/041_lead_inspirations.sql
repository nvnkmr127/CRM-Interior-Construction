-- Migration: 041_lead_inspirations.sql

CREATE TABLE IF NOT EXISTS lead_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  room_type VARCHAR(100), -- e.g. 'Kitchen', 'Living Room', 'Bedroom'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_inspirations_lead ON lead_inspirations(lead_id);
