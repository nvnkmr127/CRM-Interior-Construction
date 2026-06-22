-- Up Migration
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS referred_by_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by ON leads(referred_by_lead_id);

-- Down Migration
-- ALTER TABLE leads DROP COLUMN referred_by_lead_id;
