-- Migration: 035_site_visits.sql
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  scheduled_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, checked_in, completed, cancelled
  
  -- Check-in & Location
  gps_coordinates JSONB DEFAULT '{}'::jsonb,
  
  -- Visit Data
  checklist JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  measurements JSONB DEFAULT '{}'::jsonb,
  voice_notes_url VARCHAR(255),
  customer_signature_url VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site Visit Photos Table
CREATE TABLE IF NOT EXISTS site_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  file_url VARCHAR(255) NOT NULL,
  caption VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
