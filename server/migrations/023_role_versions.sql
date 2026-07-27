-- Migration: 023_role_versions.sql
-- Description: Creates the role_versions table to track history of role configurations.

CREATE TABLE IF NOT EXISTS role_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  permissions JSONB DEFAULT '[]'::jsonb,
  data_scopes JSONB DEFAULT '{}'::jsonb,
  field_permissions JSONB DEFAULT '{}'::jsonb,
  enabled_modules JSONB DEFAULT '[]'::jsonb,
  page_permissions JSONB DEFAULT '{}'::jsonb,
  change_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (role_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_role_versions_tenant ON role_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_role_versions_role ON role_versions(role_id);
