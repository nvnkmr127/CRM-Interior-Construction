-- Migration: 036_communications_and_views.sql

-- 1. Unified Communications Table
-- This handles WhatsApp, Email, SMS, and Calls as a unified timeline.
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- the rep who sent/received it
  
  channel VARCHAR(50) NOT NULL, -- whatsapp, email, sms, call
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed, received
  
  subject VARCHAR(255),
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- message IDs, attachments, tags
  
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_communications_tenant_id ON communications(tenant_id);

-- 2. Advanced Custom Views Table
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'lead',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(10) DEFAULT 'DESC',
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Quote Engagement Tracking
-- Adding engagement tracking to projects or quotes if they exist.
-- Assuming 'quotes' table exists, if not, we can safely ignore or alter.
-- We'll just alter 'projects' if quotes doesn't exist, but typically quotes are separate.
-- We'll add this to 'leads' directly for now as 'last_quote_opened_at'
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_quote_opened_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS quote_view_count INTEGER DEFAULT 0;
