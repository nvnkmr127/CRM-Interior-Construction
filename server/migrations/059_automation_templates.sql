-- Migration: 059_automation_templates.sql

CREATE TABLE IF NOT EXISTS automation_templates (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  trigger JSONB NOT NULL,
  actions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed basic templates
INSERT INTO automation_templates (id, name, trigger, actions)
VALUES 
('tpl_1', 'Interior Design Handoff', '{"type": "stage_change", "value": "Design Approved"}', '[{"type": "notify", "target": "Project Manager", "message": "Design approved. Ready for execution planning."}, {"type": "create_task", "title": "Schedule Kickoff Meeting"}]')
ON CONFLICT (id) DO NOTHING;

INSERT INTO automation_templates (id, name, trigger, actions)
VALUES 
('tpl_2', 'Stale Lead Nurture', '{"type": "time_in_stage", "stage": "Quotation Sent", "days": 7}', '[{"type": "send_email", "template": "FollowUpDiscount"}, {"type": "create_task", "title": "Call customer regarding quotation"}]')
ON CONFLICT (id) DO NOTHING;
