-- 20260723_enterprise_security.sql

-- 1. Tenant Security Settings
CREATE TABLE IF NOT EXISTS tenant_security_settings (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    mfa_required_all BOOLEAN DEFAULT false,
    session_timeout_minutes INT DEFAULT 120,
    concurrent_login_limit INT DEFAULT 3,
    password_min_length INT DEFAULT 8,
    password_require_symbols BOOLEAN DEFAULT true,
    password_require_numbers BOOLEAN DEFAULT true,
    password_expiry_days INT DEFAULT 90,
    password_prevent_reuse INT DEFAULT 3,
    allowed_ips JSONB DEFAULT '[]'::jsonb,
    allowed_countries JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. User Security Settings
CREATE TABLE IF NOT EXISTS user_security (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    mfa_method VARCHAR(50) DEFAULT 'email',
    last_password_change TIMESTAMP DEFAULT NOW(),
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP
);

-- 3. Trusted Devices
CREATE TABLE IF NOT EXISTS user_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_user ON user_trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_fingerprint ON user_trusted_devices(device_fingerprint);

-- 4. Password History
CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);

-- 5. OTP Codes
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'login',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_user ON otp_codes(user_id);

-- Add last_active_at to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW();

-- Pre-populate user_security for existing users
INSERT INTO user_security (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Pre-populate tenant_security_settings for existing tenants
INSERT INTO tenant_security_settings (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
