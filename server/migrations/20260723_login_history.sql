-- Create Login History table
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    email_attempted VARCHAR(255),
    login_time TIMESTAMP DEFAULT NOW(),
    logout_time TIMESTAMP,
    duration_seconds INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(100),
    os VARCHAR(100),
    device VARCHAR(100),
    location VARCHAR(255),
    status VARCHAR(50),
    failure_reason VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_login_history_tenant ON login_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_session ON login_history(session_id);
