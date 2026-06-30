CREATE TABLE IF NOT EXISTS vendor_capacity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  estimated_team_strength INT DEFAULT 0,
  max_concurrent_projects INT DEFAULT 5,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, overloaded
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, vendor_name)
);
