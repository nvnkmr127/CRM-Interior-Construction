-- Migration: 047_intelligence_tables.sql

CREATE TABLE IF NOT EXISTS lead_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  buying_intent INTEGER,
  budget_score INTEGER,
  engagement_score INTEGER,
  response_score INTEGER,
  risk_score INTEGER,
  competition_score INTEGER,
  timeline_score INTEGER,
  overall_score INTEGER,
  calculated_by UUID REFERENCES users(id),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_score_history_lead ON lead_scores_history(lead_id);

CREATE TABLE IF NOT EXISTS lead_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment VARCHAR(50),
  buying_intent VARCHAR(50),
  next_action TEXT,
  predicted_close_date DATE,
  predicted_revenue NUMERIC(12,2),
  risk_level VARCHAR(50),
  objections TEXT,
  confidence INTEGER,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  competitor VARCHAR(255),
  pricing NUMERIC(12,2),
  customer_feedback TEXT,
  lost_reason TEXT,
  won_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
