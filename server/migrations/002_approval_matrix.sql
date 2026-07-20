CREATE TABLE IF NOT EXISTS approval_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    min_amount DECIMAL(12,2) DEFAULT 0.00,
    max_amount DECIMAL(12,2),
    department VARCHAR(100),
    branch VARCHAR(100),
    approval_levels INTEGER DEFAULT 1,
    required_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    priority VARCHAR(50),
    effective_date TIMESTAMP,
    expiry_date TIMESTAMP,
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
