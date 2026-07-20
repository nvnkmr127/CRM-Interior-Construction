-- Migration: 011_interior_construction_financials.sql
-- Description: Creates explicit tables for BOQ, Work Orders, Vendor Bills, and Material Requests.

CREATE TABLE IF NOT EXISTS boqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contractor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    total_amount DECIMAL(12,2) DEFAULT 0.00,
    advance_percentage DECIMAL(5,2) DEFAULT 0.00,
    retention_percentage DECIMAL(5,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'issued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id),
    estimated_cost DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES users(id),
    base_amount DECIMAL(12,2) DEFAULT 0.00,
    gst_rate DECIMAL(5,2) DEFAULT 18.00,
    cgst_amount DECIMAL(12,2) DEFAULT 0.00,
    sgst_amount DECIMAL(12,2) DEFAULT 0.00,
    igst_amount DECIMAL(12,2) DEFAULT 0.00,
    tds_rate DECIMAL(5,2) DEFAULT 0.00,
    tds_amount DECIMAL(12,2) DEFAULT 0.00,
    retention_amount DECIMAL(12,2) DEFAULT 0.00,
    net_payable DECIMAL(12,2) DEFAULT 0.00,
    bill_type VARCHAR(50) DEFAULT 'vendor', -- vendor or contractor
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
