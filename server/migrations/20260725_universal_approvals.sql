-- Migration: 20260725_universal_approvals.sql
-- Description: Adds universal approval tracking for all major financial and operational entities

CREATE TABLE IF NOT EXISTS approval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'quotation', 'purchase_order', 'invoice', etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'requested', 'approved', 'rejected'
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_logs_entity ON approval_logs(entity_type, entity_id);

-- Quotations
ALTER TABLE IF EXISTS quotations
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Purchase Orders
ALTER TABLE IF EXISTS purchase_orders
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Invoices
ALTER TABLE IF EXISTS invoices
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Vendor Bills (if applicable)
ALTER TABLE IF EXISTS vendor_bills
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Material Requests
ALTER TABLE IF EXISTS material_requests
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Change Orders (Extra Work)
ALTER TABLE IF EXISTS change_orders
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Design Reviews
ALTER TABLE IF EXISTS design_reviews
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Payments
ALTER TABLE IF EXISTS payments
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

ALTER TABLE IF EXISTS vendor_payments
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'draft';

-- Discounts (Assuming discount_approvals doesn't cover all we need, we add status to wherever it's needed)
ALTER TABLE IF EXISTS discount_approvals
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';

-- Vendors
ALTER TABLE IF EXISTS vendors
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';
