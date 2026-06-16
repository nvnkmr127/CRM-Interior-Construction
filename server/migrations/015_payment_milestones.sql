CREATE TABLE IF NOT EXISTS payment_milestones (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_milestones(tenant_id, status);
