-- Migration: 104_delay_notifications.sql
-- Description: Creates the delay_notifications table to handle client communications when dates are missed.

CREATE TABLE IF NOT EXISTS delay_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE, -- Null means project target_date delay
  
  type VARCHAR(50) NOT NULL, -- milestone_delay, project_delay
  original_date DATE NOT NULL,
  revised_date DATE,
  reason TEXT,
  message_draft TEXT NOT NULL,
  
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, cancelled
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delay_notif_proj ON delay_notifications(project_id);
