CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  permissions JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(tenant_id, email);

DO $$
DECLARE
  v_tenant_id UUID;
  v_role_id UUID;
BEGIN
  -- Get the demo tenant ID
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
  
  IF v_tenant_id IS NOT NULL THEN
    -- Insert superadmin role if it doesn't exist for this tenant
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = v_tenant_id AND name = 'superadmin') THEN
      INSERT INTO roles (tenant_id, name, permissions, is_system)
      VALUES (v_tenant_id, 'superadmin', '["*"]', true)
      RETURNING id INTO v_role_id;
    ELSE
      SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = 'superadmin' LIMIT 1;
    END IF;

    -- Insert admin user if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM users WHERE tenant_id = v_tenant_id AND email = 'admin@demo.com') THEN
      INSERT INTO users (tenant_id, role_id, name, email, password_hash)
      VALUES (
        v_tenant_id, 
        v_role_id, 
        'Admin User', 
        'admin@demo.com', 
        '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm'
      );
    END IF;
  END IF;
END $$;
