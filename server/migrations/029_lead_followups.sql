CREATE TABLE IF NOT EXISTS lead_followups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id),
  assignee_id UUID REFERENCES users(id),
  title       TEXT NOT NULL,
  due_at      TIMESTAMPTZ NOT NULL,
  is_done     BOOLEAN DEFAULT FALSE,
  done_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lead_followups_lead_id ON lead_followups(lead_id);
CREATE INDEX idx_lead_followups_due_at ON lead_followups(due_at) WHERE is_done = FALSE;
