-- Migration: 086_vendor_payments.sql
-- Description: Adds tables for Vendor Payment Tracking system.

CREATE TABLE IF NOT EXISTS vendor_payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES project_vendors(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  material_delivery_id UUID REFERENCES material_deliveries(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  percentage DECIMAL(5, 2),
  due_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'partially paid', 'paid', 'overdue')),
  paid_amount DECIMAL(12, 2) DEFAULT 0.00,
  paid_at DATE,
  invoice_reference VARCHAR(255),
  payment_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_payments_project ON vendor_payment_milestones(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payment_milestones(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_po ON vendor_payment_milestones(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_status ON vendor_payment_milestones(tenant_id, status);
