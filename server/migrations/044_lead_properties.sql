-- Migration: 044_lead_properties.sql

CREATE TABLE IF NOT EXISTS lead_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_type VARCHAR(100),
  builder VARCHAR(255),
  project_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  pincode VARCHAR(20),
  floor VARCHAR(50),
  carpet_area NUMERIC(10,2),
  builtup_area NUMERIC(10,2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  house_status VARCHAR(100),
  possession_date DATE,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_properties_lead ON lead_properties(lead_id);
