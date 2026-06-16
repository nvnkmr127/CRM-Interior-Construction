CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  permissions TEXT DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id TEXT REFERENCES roles(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  avatar_url VARCHAR(500),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(tenant_id, email);

-- Insert superadmin role if it doesn't exist for demo tenant
INSERT INTO roles (tenant_id, name, permissions, is_system)
SELECT id, 'superadmin', '["*"]', 1
FROM tenants WHERE slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM roles 
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo') 
  AND name = 'superadmin'
);

-- Insert admin user if it doesn't exist for demo tenant
INSERT INTO users (tenant_id, role_id, name, email, password_hash)
SELECT 
  t.id, 
  r.id, 
  'Admin User', 
  'admin@demo.com', 
  '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm'
FROM tenants t
JOIN roles r ON r.tenant_id = t.id AND r.name = 'superadmin'
WHERE t.slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM users 
  WHERE tenant_id = t.id AND email = 'admin@demo.com'
);
