CREATE TABLE IF NOT EXISTS payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2),
  percentage DECIMAL(5,2),  -- % of contract value (alternative to fixed amount)
  due_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled',
  -- scheduled → invoice_raised → paid → overdue
  invoice_reference VARCHAR(255),
  paid_at TEXT,
  paid_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_milestones(tenant_id, status);
