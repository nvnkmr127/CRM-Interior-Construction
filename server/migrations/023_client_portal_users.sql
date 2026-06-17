CREATE TABLE IF NOT EXISTS client_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  otp_hash VARCHAR(64),                -- SHA-256 of OTP
  otp_expires_at TEXT,
  portal_token_hash VARCHAR(64),       -- long-lived portal session token
  portal_token_expires_at TEXT,
  last_login_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_phone_project
  ON client_portal_users(tenant_id, project_id, phone);
