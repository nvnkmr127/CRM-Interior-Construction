-- Migration: 038_automated_sequences.sql

CREATE TABLE IF NOT EXISTS automated_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  trigger_event VARCHAR(100), -- e.g., 'lead_created', 'proposal_sent'
  status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
  step_index INTEGER DEFAULT 0,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automated_sequences_lead ON automated_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_automated_sequences_next_run ON automated_sequences(next_run_at);
