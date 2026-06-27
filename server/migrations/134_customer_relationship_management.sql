-- Migration: 134_customer_relationship_management.sql
-- Description: Adds tables for long-term customer relationship management and referral programs.

-- 1. Client relationship records
CREATE TABLE IF NOT EXISTS client_relationship_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  project_completed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  anniversary_date DATE NOT NULL,
  last_followup_date DATE,
  next_followup_schedule_date DATE NOT NULL,
  followup_notes TEXT,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_client_relationship_project ON client_relationship_records(project_id);

-- 2. Client referrals
CREATE TABLE IF NOT EXISTS client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  referee_name VARCHAR(255) NOT NULL,
  referee_phone VARCHAR(50),
  referee_email VARCHAR(255),
  referral_status VARCHAR(50) DEFAULT 'pending', -- pending, converted, closed
  reward_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, not_eligible
  reward_amount DECIMAL(12, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON client_referrals(referrer_project_id);
