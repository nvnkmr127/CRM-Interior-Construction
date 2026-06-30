-- Migration: 164_site_expenses.sql
-- Description: Creates site_expenses table for tracking petty cash and daily site spending.

CREATE TABLE IF NOT EXISTS site_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('material', 'labour_advance', 'transport', 'miscellaneous')),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  description TEXT NOT NULL,
  receipt_photo_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE,
  is_reimbursed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_expenses_project ON site_expenses(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_expenses_status ON site_expenses(tenant_id, status);
