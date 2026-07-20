ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS backup_approver UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS assigned_date TIMESTAMP;
ALTER TABLE financial_approvals ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

