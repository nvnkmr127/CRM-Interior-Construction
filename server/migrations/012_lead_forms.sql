-- 012_lead_forms.sql

CREATE TABLE IF NOT EXISTS lead_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    success_message TEXT,
    redirect_url VARCHAR(255),
    lead_source VARCHAR(100),
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    fields JSONB NOT NULL DEFAULT '[]',
    views INTEGER DEFAULT 0,
    submissions INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS lead_form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    data JSONB NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_forms_tenant_id ON lead_forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_forms_slug ON lead_forms(slug);
CREATE INDEX IF NOT EXISTS idx_lead_form_submissions_tenant_id ON lead_form_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_form_submissions_form_id ON lead_form_submissions(form_id);
