ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS target_resolution_date TIMESTAMP;
ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
UPDATE financial_approvals SET target_resolution_date = created_at + INTERVAL '72 hours' WHERE target_resolution_date IS NULL;

