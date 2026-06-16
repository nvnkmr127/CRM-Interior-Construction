CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type      VARCHAR(100) NOT NULL,
  message   TEXT         NOT NULL,
  reference_url VARCHAR(500),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant
  ON notifications(tenant_id, created_at DESC);
