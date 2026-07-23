-- Up Migration

-- Create Login History Table
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID, -- Nullable for failed logins where user might not be found
    email_attempted VARCHAR(255),
    login_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    browser VARCHAR(255),
    os VARCHAR(255),
    device VARCHAR(255),
    ip_address VARCHAR(45),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'success', -- 'success' or 'failure'
    failure_reason VARCHAR(255),
    session_id VARCHAR(255), -- Corresponds to id in sessions table if successful
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_history_tenant_user ON login_history (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_time ON login_history (login_time);

-- Add indexes to audit_logs for faster timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
