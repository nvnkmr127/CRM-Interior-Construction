-- Migration: 051_referral_system.sql

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  referred_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  reward VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_lead_id, referred_lead_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_lead_id);
