CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  entity VARCHAR(50) NOT NULL,
  record TEXT NOT NULL,
  changes TEXT DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INT DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_pending ON automation_jobs(status, created_at) WHERE status = 'pending';
