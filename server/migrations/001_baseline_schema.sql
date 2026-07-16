CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'starter',
  config TEXT DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

INSERT INTO tenants (name, slug) VALUES ('Demo Company', 'demo')
ON CONFLICT (slug) DO NOTHING;
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  permissions TEXT DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  avatar_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(tenant_id, email);

-- Insert superadmin role if it doesn't exist for demo tenant
INSERT INTO roles (tenant_id, name, permissions, is_system)
SELECT id, 'superadmin', '["*"]', true
FROM tenants WHERE slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM roles 
  WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'demo') 
  AND name = 'superadmin'
);

-- Insert admin user if it doesn't exist for demo tenant
INSERT INTO users (tenant_id, role_id, name, email, password_hash)
SELECT 
  t.id, 
  r.id, 
  'Admin User', 
  'admin@demo.com', 
  '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm'
FROM tenants t
JOIN roles r ON r.tenant_id = t.id AND r.name = 'superadmin'
WHERE t.slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM users 
  WHERE tenant_id = t.id AND email = 'admin@demo.com'
);
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- CLEANUP JOB NOTE: 
-- Sessions should be purged where expires_at < NOW() 
-- via a scheduled task (to be added in Phase 2).
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,     -- e.g. 'lead.created', 'task.status_changed'
  entity VARCHAR(100) NOT NULL,     -- e.g. 'lead', 'project', 'task'
  entity_id UUID,
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- NOTE: This table is NEVER updated or deleted from — only INSERTs.
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  source VARCHAR(100),              -- 'facebook','website','indimart','manual'
  stage_id UUID,                    -- FK added after lead_stages created in 006
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  score BOOLEAN DEFAULT FALSE,
  custom_fields TEXT DEFAULT '{}',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  converted_to_project_id UUID,     -- set when lead→project
  deleted_at TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assignee ON leads(assignee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(tenant_id, status);
CREATE TABLE IF NOT EXISTS lead_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B6B6B',
  sort_order INTEGER DEFAULT 0,
  is_won BOOLEAN DEFAULT false,
  is_lost BOOLEAN DEFAULT false,
  mandatory_fields TEXT DEFAULT '[]',   -- fields required before leaving this stage
  entry_criteria TEXT,                    -- description for UI display
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add FK now that lead_stages exists


-- Seed default stages for demo tenant
INSERT INTO lead_stages (tenant_id, name, color, sort_order) VALUES
((SELECT id FROM tenants WHERE slug='demo'), 'New', '#6B6B6B', 1),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Contacted', '#1A3A5C', 2),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Qualified', '#C4956A', 3),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Site Visit Scheduled', '#8B5E0A', 4),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Proposal Sent', '#2D5A8E', 5),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Won', '#2D6A4F', 6),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Lost', '#8B2020', 7)

ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  project_id UUID,                   -- set when activity is on a project
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,         -- 'call','note','email','whatsapp','site_visit','meeting'
  title VARCHAR(255),
  notes TEXT,
  outcome VARCHAR(100),              -- 'connected','no_answer','interested','callback'
  scheduled_at TEXT,
  completed_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  field VARCHAR(100) NOT NULL,       -- 'source','custom_fields.budget','phone'
  operator VARCHAR(50) NOT NULL,     -- 'eq','neq','contains','is_not_empty'
  value TEXT,
  weight INTEGER NOT NULL DEFAULT 10,-- positive or negative
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scoring_tenant ON lead_scoring_rules(tenant_id, is_active);

-- Seed default scoring rules for demo tenant
INSERT INTO lead_scoring_rules (tenant_id, name, field, operator, value, weight) VALUES
  ((SELECT id FROM tenants WHERE slug='demo'), 'Facebook Source', 'source', 'eq', 'facebook', 5),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Indimart Source', 'source', 'eq', 'indimart', 10),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Referral Source', 'source', 'eq', 'referral', 20),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Phone Number Provided', 'phone', 'is_not_empty', NULL, 15),
  ((SELECT id FROM tenants WHERE slug='demo'), 'Budget over 10L', 'custom_fields.budget', 'contains', '>10L', 25);
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID,                         -- source lead (nullable — direct creation allowed)
  client_name VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  client_email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),
  pm_id UUID REFERENCES users(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  contract_value DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'active',  -- active, on_hold, completed, cancelled
  start_date DATE,
  target_date DATE,
  site_address TEXT,
  custom_fields TEXT DEFAULT '{}',
  deleted_at TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(tenant_id, status);
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  duration_days INTEGER,
  starts_at DATE,
  ends_at DATE,
  sign_off_required BOOLEAN DEFAULT true,
  sign_off_by VARCHAR(50) DEFAULT 'pm',  -- 'pm','designer','client','all'
  signed_off_by UUID REFERENCES users(id),
  signed_off_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
-- Migration 010: V2 Sales Intelligence Additions

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(50) DEFAULT 'Low';

CREATE TABLE IF NOT EXISTS lead_objections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  suggested_rebuttal TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_objections_lead_id ON lead_objections(lead_id);
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed
  completion_date DATE,
  completed_by UUID REFERENCES users(id),
  triggers_payment BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_milestones_phase ON milestones(phase_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
-- Migration 011: V2 Measurements and Workflows

CREATE TABLE IF NOT EXISTS lead_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  length DECIMAL(10, 2),
  width DECIMAL(10, 2),
  height DECIMAL(10, 2),
  unit VARCHAR(20) DEFAULT 'feet',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_measurements_lead ON lead_measurements(lead_id);

CREATE TABLE IF NOT EXISTS lead_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  conditions JSONB DEFAULT '[]',
  actions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- for subtasks
  title VARCHAR(500) NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent
  status VARCHAR(50) DEFAULT 'todo',      -- todo, in_progress, blocked, done
  sort_order INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  custom_fields TEXT DEFAULT '{}',
  deleted_at TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
-- Migration 012: V3 Portal and Sentiment additions

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'Neutral';
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  name VARCHAR(500) NOT NULL,
  doc_type VARCHAR(100),     -- 'drawing','boq','render','contract','photo','invoice'
  version BOOLEAN DEFAULT TRUE,
  storage_key VARCHAR(1000) NOT NULL,  -- S3 object key
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending_review', -- pending_review, approved, revision_requested
  approved_by UUID REFERENCES users(id),
  approved_at TEXT,
  revision_note TEXT,
  is_visible_to_client BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_docs_phase ON documents(phase_id);
CREATE TABLE IF NOT EXISTS payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2),
  percentage DECIMAL(5,2),  -- % of contract value (alternative to fixed amount)
  due_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled',
  -- scheduled → invoice_raised → paid → overdue
  invoice_reference VARCHAR(255),
  paid_at TEXT,
  paid_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_project ON payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_milestones(tenant_id, status);
CREATE TABLE IF NOT EXISTS custom_fields_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity VARCHAR(50) NOT NULL,   -- 'lead','project','task','contact'
  name VARCHAR(100) NOT NULL,    -- internal key e.g. 'budget_range'
  label VARCHAR(200) NOT NULL,   -- display label e.g. 'Budget Range'
  field_type VARCHAR(50) NOT NULL, -- 'text','number','date','dropdown','multi_select','file','boolean'
  options TEXT DEFAULT '[]',    -- for dropdown/multi_select
  is_required BOOLEAN DEFAULT false,
  visible_to_roles TEXT DEFAULT '["all"]',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_tenant_entity_name
  ON custom_fields_config(tenant_id, entity, name);
CREATE INDEX IF NOT EXISTS idx_cf_tenant_entity
  ON custom_fields_config(tenant_id, entity);
CREATE TABLE IF NOT EXISTS project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),
  description TEXT,
  phases TEXT DEFAULT '[]',
  -- phases structure: [{name, duration_days, milestones:[{name,triggers_payment}]}]
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON project_templates(tenant_id);

-- Seed 2 default templates for demo tenant
INSERT INTO project_templates (tenant_id, name, project_type, description, phases)
SELECT id, 'Full Home Interior', 'Interior Design', 'Standard end-to-end full home interior project template.',
  '[
    {"name": "Design", "duration_days": 14, "milestones": [{"name": "Design Sign-off", "triggers_payment": true}]},
    {"name": "Procurement", "duration_days": 7, "milestones": []},
    {"name": "Execution", "duration_days": 45, "milestones": [{"name": "Woodwork Complete", "triggers_payment": true}]},
    {"name": "Handover", "duration_days": 3, "milestones": [{"name": "Final Handover", "triggers_payment": true}]}
  ]'
FROM tenants 
WHERE slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM project_templates 
  WHERE tenant_id = tenants.id AND name = 'Full Home Interior'
);

INSERT INTO project_templates (tenant_id, name, project_type, description, phases)
SELECT id, 'Modular Kitchen', 'Kitchen', 'Quick turnaround modular kitchen project.',
  '[
    {"name": "Measurement", "duration_days": 2, "milestones": []},
    {"name": "Design", "duration_days": 5, "milestones": [{"name": "Design Sign-off", "triggers_payment": true}]},
    {"name": "Manufacturing", "duration_days": 21, "milestones": [{"name": "Dispatch from Factory", "triggers_payment": true}]},
    {"name": "Installation", "duration_days": 3, "milestones": [{"name": "Installation Complete", "triggers_payment": true}]}
  ]'
FROM tenants 
WHERE slug = 'demo'
AND NOT EXISTS (
  SELECT 1 FROM project_templates 
  WHERE tenant_id = tenants.id AND name = 'Modular Kitchen'
);
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger TEXT NOT NULL,
  -- trigger: { type: 'record.created'|'field.changed'|'date.condition'|'webhook.received',
  --            entity: 'lead'|'project'|'task', config: {...} }
  conditions TEXT DEFAULT '[]',
  -- conditions: [{ field, operator, value, logic:'AND'|'OR' }]
  actions TEXT DEFAULT '[]',
  -- actions: [{ type: 'send_whatsapp'|'create_task'|'update_field'|
  --             'assign_user'|'call_webhook'|'send_email', config: {...} }]
  is_active BOOLEAN DEFAULT true,
  last_run_at TEXT,
  run_count BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automations_tenant ON automation_rules(tenant_id, is_active);
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
-- Seed comprehensive automation rules (Items 1-13)

DO $$
DECLARE
    v_tenant_id UUID;
    v_sys_user_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    SELECT id INTO v_sys_user_id FROM users WHERE email = 'admin@demo.com' AND tenant_id = v_tenant_id LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        DELETE FROM automation_rules WHERE tenant_id = v_tenant_id;

        -- 1. Lead Capture Automation
        -- Rule 1.1: General Lead Setup (Welcome WhatsApp, Assignment if not VIP)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.1 General Lead Setup', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "budget", "operator": "lt", "value": "2500000", "logic": "OR"}, {"field": "budget", "operator": "is_empty", "logic": "OR"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "round_robin"}},
                {"type": "send_whatsapp", "config": {"templateId": "general_welcome"}},
                {"type": "create_task", "config": {"title": "Initial Contact", "dueInHours": 24}}
            ]', v_sys_user_id
        );

        -- Rule 1.2: VIP Lead Setup
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.2 VIP Lead Setup', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "budget", "operator": "gt", "value": "2499999", "logic": "AND"}]',
            '[
                {"type": "update_field", "config": {"field": "is_vip", "value": true}},
                {"type": "assign_user", "config": {"strategy": "senior_rep"}},
                {"type": "create_task", "config": {"title": "Call VIP Lead immediately", "dueInHours": 1}},
                {"type": "invoke_ai", "config": {"actionType": "generate_summary", "outputField": "ai_summary"}},
                {"type": "send_whatsapp", "config": {"templateId": "vip_welcome"}}
            ]', v_sys_user_id
        );

        -- Rule 1.3: Repeat Customer
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.3 Repeat Customer Mapping', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "customer_type", "operator": "eq", "value": "repeat", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Welcome back repeat customer", "dueInHours": 24}}]', v_sys_user_id
        );

        -- 2. Lead Assignment
        -- Rule 2.1: Territory Routing (Bangalore)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '2.1 Bangalore Territory Assignment', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "city", "operator": "eq", "value": "Bangalore", "logic": "AND"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "round_robin"}},
                {"type": "create_task", "config": {"title": "Welcome Local Lead", "dueInHours": 12}}
            ]', v_sys_user_id
        );

        -- 3. Follow-up Escalations
        -- Rule 3.1: 24h Reminder
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.1 24hr Reminder', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 24}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Reminder: Contact Lead", "dueInHours": 4}}]', v_sys_user_id
        );

        -- Rule 3.2: 48h Manager Alert
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.2 48hr No Contact Manager Alert', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 48}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Escalation: Lead untouched 48 hrs", "assignToRole": "sales_manager"}}]', v_sys_user_id
        );

        -- Rule 3.3: 72h Escalation/Reassignment
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.3 72hr Reassignment', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 72}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "reassign_round_robin"}},
                {"type": "create_task", "config": {"title": "Reassigned Lead: Contact ASAP", "dueInHours": 2}}
            ]', v_sys_user_id
        );

        -- Rule 3.4: Missed Follow-up (Simulated via Date Condition on Lead)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.4 Missed Follow-up Score Penalty', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "next_followup_date", "offsetHours": 24}}',
            '[{"field": "status", "operator": "eq", "value": "open", "logic": "AND"}]',
            '[
                {"type": "update_field", "config": {"field": "score", "value": -10, "relative": true}},
                {"type": "create_task", "config": {"title": "Overdue Follow-up! Score Penalized", "assignToRole": "sales_manager"}}
            ]', v_sys_user_id
        );

        -- 4. Communication Automation
        -- Rule 4.1: Quote Expiry
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '4.1 Quote Expiry Reminder', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "proposal_sent_at", "offsetHours": 72}}',
            '[{"field": "stage", "operator": "eq", "value": "proposal_sent", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "quote_followup"}}]', v_sys_user_id
        );

        -- 5. Activity Automation
        -- Rule 5.1: Phone Call Logged -> AI Summary
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '5.1 Phone Call Logged', '{"type": "activity_logged", "entity": "lead"}',
            '[{"field": "activity_type", "operator": "eq", "value": "call", "logic": "AND"}]',
            '[{"type": "invoke_ai", "config": {"actionType": "extract_action_items"}}]', v_sys_user_id
        );

        -- Rule 5.2: Meeting Logged
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '5.2 Post-Meeting Processing', '{"type": "activity_logged", "entity": "lead"}',
            '[{"field": "activity_type", "operator": "eq", "value": "meeting", "logic": "AND"}]',
            '[
                {"type": "invoke_ai", "config": {"actionType": "extract_action_items"}},
                {"type": "create_task", "config": {"title": "Post-meeting follow up", "dueInHours": 48}}
            ]', v_sys_user_id
        );

        -- 6. Site Visit Automation
        -- Rule 6.1: Site Visit Scheduled
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '6.1 Site Visit Scheduled', '{"type": "field.changed", "entity": "lead", "config": {"field": "site_visit_date"}}',
            '[{"field": "site_visit_date", "operator": "is_not_empty", "logic": "AND"}]',
            '[
                {"type": "send_calendar_invite", "config": {"eventTitle": "Site Visit", "eventDatePath": "site_visit_date"}},
                {"type": "send_whatsapp", "config": {"templateId": "visit_reminder"}},
                {"type": "create_task", "config": {"title": "Prepare visit checklist", "dueInHours": 2}}
            ]', v_sys_user_id
        );

        -- 7. Quotation Automation
        -- Rule 7.1: Quote Generated
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '7.1 Quote Generated', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "proposal_generated", "logic": "AND"}]',
            '[
                {"type": "send_whatsapp", "config": {"templateId": "quote_ready"}},
                {"type": "create_task", "config": {"title": "Review quote with customer", "dueInHours": 24}}
            ]', v_sys_user_id
        );

        -- Rule 7.2: Quote Accepted
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '7.2 Quote Accepted', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "quote_accepted", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Process Booking & Collect Advance", "dueInHours": 24}},
                {"type": "create_task", "config": {"title": "Approve Finance / Notify Accounts", "assignToRole": "admin"}}
            ]', v_sys_user_id
        );

        -- 8. Stage Automation
        -- Rule 8.1: Site Visit Completed -> Move to Measurement
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '8.1 Post Site Visit / Measurement', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "site_visit_completed", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Complete Measurements", "dueInHours": 48}},
                {"type": "send_whatsapp", "config": {"templateId": "thank_you_visit"}}
            ]', v_sys_user_id
        );

        -- 9. AI Automation
        -- Rule 9.1: Lost Opportunity AI Review
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '9.1 AI Win-Back Analysis', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "lost", "logic": "AND"}]',
            '[{"type": "invoke_ai", "config": {"actionType": "win_back_analysis"}}]', v_sys_user_id
        );

        -- 10. Manager Notifications (Lead Aging 30 days)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '10.1 Lead Aging 30 Days', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 720}}',
            '[{"field": "stage", "operator": "eq", "value": "new", "logic": "AND"}]',
            '[
                {"type": "invoke_ai", "config": {"actionType": "diagnose_delay"}},
                {"type": "create_task", "config": {"title": "Lead aged > 30 days. Review required.", "assignToRole": "sales_manager"}}
            ]', v_sys_user_id
        );

        -- 11. Operations Automation
        -- Rule 11.1: Advance Received -> Project Handover
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '11.1 Project Handover', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "advance_received", "logic": "AND"}]',
            '[
                {"type": "create_project", "config": {}},
                {"type": "send_email", "config": {"templateId": "welcome_journey"}}
            ]', v_sys_user_id
        );

        -- 12. Customer Experience
        -- Rule 12.1: Post Handover Survey
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '12.1 Post-Project Survey', '{"type": "field.changed", "entity": "project", "config": {"field": "status"}}',
            '[{"field": "status", "operator": "eq", "value": "handed_over", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "csat_survey"}}]', v_sys_user_id
        );

        -- 13. Referral Management
        -- Rule 13.1: Happy Customer (NPS > 8)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '13.1 Referral Request', '{"type": "field.changed", "entity": "project", "config": {"field": "nps_score"}}',
            '[{"field": "nps_score", "operator": "gt", "value": "8", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "referral_request"}}]', v_sys_user_id
        );

        -- Rule 13.2: Referral Received (New Lead created with referral source)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '13.2 Referral Reward Notify', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "referral_source", "operator": "is_not_empty", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Send Referral Reward to Referrer", "dueInHours": 48}}
            ]', v_sys_user_id
        );

    END IF;
END $$;
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 hash of the raw key
  key_prefix VARCHAR(8) NOT NULL,        -- first 8 chars for display e.g. 'crm_a1b2'
  scopes TEXT DEFAULT '["read"]',
  -- scopes options: 'read','write','admin','leads:read','leads:write',
  --                 'projects:read','projects:write','webhooks:manage'
  rate_limit_rpm INTEGER DEFAULT 60,
  ip_allowlist TEXT DEFAULT '[]',       -- empty = allow all IPs
  expires_at TEXT,
  last_used_at TEXT,
  last_used_ip VARCHAR(45),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE TABLE IF NOT EXISTS outbound_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),               -- used for HMAC-SHA256 signing
  events TEXT DEFAULT '[]',         -- e.g. ['lead.created','project.phase_completed']
  custom_headers TEXT DEFAULT '{}',
  payload_template TEXT,            -- optional custom payload shape
  retry_count INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES outbound_webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload TEXT,
  status_code INTEGER,
  response_body TEXT,
  latency_ms INTEGER,
  attempt_number BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS webhook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  source_key VARCHAR(255) UNIQUE NOT NULL,
  secret VARCHAR(255),
  field_mapping TEXT DEFAULT '[]',
  dedup_field VARCHAR(100),
  default_stage_id UUID REFERENCES lead_stages(id) ON DELETE SET NULL,
  default_assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_sources_tenant ON webhook_sources(tenant_id);

CREATE TABLE IF NOT EXISTS inbound_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_key VARCHAR(255),
  raw_payload TEXT,
  mapped_data TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  status VARCHAR(50),
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inbound_webhook_logs_tenant ON inbound_webhook_logs(tenant_id);
CREATE TABLE IF NOT EXISTS snags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raised_by UUID REFERENCES users(id),            -- null if raised by portal client
  raised_by_client BOOLEAN DEFAULT false,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  photo_keys TEXT DEFAULT '[]',                  -- S3 keys for attached photos
  category VARCHAR(100),                          -- 'carpentry','electrical','plumbing','paint'
  assignee_id UUID REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'open',
  -- open → assigned → in_progress → resolved → client_verified
  sla_hours INTEGER DEFAULT 48,
  resolved_at TEXT,
  resolution_note TEXT,
  client_verified_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snags_project ON snags(project_id);
CREATE INDEX IF NOT EXISTS idx_snags_status ON snags(tenant_id, status);
CREATE TABLE IF NOT EXISTS handover_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',   -- in_progress, signed_off
  signed_by_client_at TEXT,
  client_name VARCHAR(255),
  client_otp_verified BOOLEAN DEFAULT false,
  pdf_key VARCHAR(1000),                       -- S3 key for generated PDF
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES handover_checklists(id) ON DELETE CASCADE,
  room VARCHAR(100),
  description VARCHAR(500) NOT NULL,
  photo_key VARCHAR(1000),
  is_checked BOOLEAN DEFAULT false,
  checked_at TEXT,
  checked_by UUID REFERENCES users(id)
);
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
CREATE TABLE IF NOT EXISTS portal_otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_otp_requests_phone_time
  ON portal_otp_requests(phone, requested_at);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type      VARCHAR(100) NOT NULL,
  message   TEXT         NOT NULL,
  reference_url VARCHAR(500),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(255),
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant
  ON notifications(tenant_id, created_at DESC);
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  reference_url VARCHAR(500),
  actor_id UUID REFERENCES users(id),
  actor_name VARCHAR(255),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
-- Fix score column: was incorrectly created as BOOLEAN, must be INTEGER (0-100 scoring range)
DO $$ 
BEGIN
  -- Intentionally left blank because column is already integer in this DB instance
END $$;
CREATE TABLE IF NOT EXISTS lead_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id),
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  storage_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON lead_files(lead_id);
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
CREATE INDEX IF NOT EXISTS idx_lead_followups_lead_id ON lead_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_followups_due_at ON lead_followups(due_at) WHERE is_done = FALSE;
-- Add missing columns to leads table that are referenced in the UI
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS property_type      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS scope              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS locality           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS budget_max         NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS carpet_area_sqft   NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS dnc_flag           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_whatsapp   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS competitor_mentioned TEXT,
  ADD COLUMN IF NOT EXISTS lead_number        VARCHAR(20);

-- Fix score column: BOOLEAN -> INTEGER (if not already done by migration 027)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'score'
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE leads
      ALTER COLUMN score DROP DEFAULT,
      ALTER COLUMN score TYPE INTEGER USING CASE WHEN score THEN 1 ELSE 0 END,
      ALTER COLUMN score SET DEFAULT 0;
  END IF;
END $$;

-- Auto-generate lead_number for existing rows
UPDATE leads SET lead_number = 'LD-' || UPPER(SUBSTRING(id::text, 1, 6))
WHERE lead_number IS NULL;
-- Phase 1: Lead Qualification Expansion
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS builder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS possession_date DATE,
  ADD COLUMN IF NOT EXISTS house_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS loan_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interior_style VARCHAR(100),
  ADD COLUMN IF NOT EXISTS material_preference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS preferred_communication VARCHAR(50),
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(50),
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lifestyle_preferences JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB DEFAULT '[]'::jsonb;
-- Phase 2: AI Lead Scoring and Pipeline Management
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ai_score_breakdown JSONB DEFAULT '{}'::jsonb;
-- Phase 3: Smart Activity & Site Visit Management
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- Migration: 034_sla_automation.sql

-- Add stage_updated_at to leads to track how long they have been in the current stage
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Set stage_updated_at to updated_at for existing leads as a fallback
UPDATE leads
SET stage_updated_at = updated_at
WHERE stage_updated_at IS NULL;

-- Add SLA fields to lead_stages to define the target SLA for each stage
ALTER TABLE lead_stages
ADD COLUMN IF NOT EXISTS max_days_in_stage INTEGER DEFAULT 3;
-- Migration: 035_site_visits.sql
CREATE TABLE IF NOT EXISTS site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  scheduled_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, checked_in, completed, cancelled
  
  -- Check-in & Location
  gps_coordinates JSONB DEFAULT '{}'::jsonb,
  
  -- Visit Data
  checklist JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  measurements JSONB DEFAULT '{}'::jsonb,
  voice_notes_url VARCHAR(255),
  customer_signature_url VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site Visit Photos Table
CREATE TABLE IF NOT EXISTS site_visit_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  site_visit_id UUID REFERENCES site_visits(id) ON DELETE CASCADE,
  file_url VARCHAR(255) NOT NULL,
  caption VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Migration: 036_communications_and_views.sql

-- 1. Unified Communications Table
-- This handles WhatsApp, Email, SMS, and Calls as a unified timeline.
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- the rep who sent/received it
  
  channel VARCHAR(50) NOT NULL, -- whatsapp, email, sms, call
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, read, failed, received
  
  subject VARCHAR(255),
  body TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- message IDs, attachments, tags
  
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_communications_tenant_id ON communications(tenant_id);

-- 2. Advanced Custom Views Table
CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) DEFAULT 'lead',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_by VARCHAR(50),
  sort_direction VARCHAR(10) DEFAULT 'DESC',
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Quote Engagement Tracking
-- Adding engagement tracking to projects or quotes if they exist.
-- Assuming 'quotes' table exists, if not, we can safely ignore or alter.
-- We'll just alter 'projects' if quotes doesn't exist, but typically quotes are separate.
-- We'll add this to 'leads' directly for now as 'last_quote_opened_at'
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_quote_opened_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS quote_view_count INTEGER DEFAULT 0;
-- Migration: 037_sales_targets.sql

CREATE TABLE IF NOT EXISTS sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_month DATE NOT NULL, -- e.g., '2026-06-01'
  target_revenue NUMERIC(15, 2) DEFAULT 0,
  target_leads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, user_id, target_month)
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_user ON sales_targets(user_id);
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
-- Migration: 039_lead_estimates.sql

CREATE TABLE IF NOT EXISTS lead_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimator_reference_id VARCHAR(100), -- ID from third party estimator app
  status VARCHAR(50) DEFAULT 'draft',
  total_amount NUMERIC(12,2),
  pdf_url TEXT,
  payload JSONB, -- store raw data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_estimates_lead ON lead_estimates(lead_id);
-- Migration: 040_lead_contacts.sql

CREATE TABLE IF NOT EXISTS lead_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  role VARCHAR(100),               -- e.g., 'Owner', 'Spouse', 'Architect', 'Builder'
  decision_authority VARCHAR(50),  -- e.g., 'Primary', 'Influencer', 'Consultant'
  relationship_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead ON lead_contacts(lead_id);
-- Migration: 040_lead_proposals.sql

CREATE TABLE IF NOT EXISTS lead_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  target_budget NUMERIC(12,2),
  proposal_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_proposals_lead ON lead_proposals(lead_id);
-- Migration: 041_lead_inspirations.sql

CREATE TABLE IF NOT EXISTS lead_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  room_type VARCHAR(100), -- e.g. 'Kitchen', 'Living Room', 'Bedroom'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_inspirations_lead ON lead_inspirations(lead_id);
-- Up Migration
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS referred_by_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_referred_by ON leads(referred_by_lead_id);

-- Down Migration
-- ALTER TABLE leads DROP COLUMN referred_by_lead_id;
-- Add geolocation columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
-- Migration: 044_lead_properties.sql

CREATE TABLE IF NOT EXISTS lead_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  property_type VARCHAR(100),
  builder VARCHAR(255),
  project_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  pincode VARCHAR(20),
  floor VARCHAR(50),
  carpet_area NUMERIC(10,2),
  builtup_area NUMERIC(10,2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  house_status VARCHAR(100),
  possession_date DATE,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_properties_lead ON lead_properties(lead_id);
-- Migration: 045_lead_preferences_and_requirements.sql

CREATE TABLE IF NOT EXISTS lead_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  interior_style VARCHAR(100),
  color_theme VARCHAR(100),
  material VARCHAR(100),
  kitchen_style VARCHAR(100),
  wardrobe_style VARCHAR(100),
  lighting VARCHAR(100),
  flooring VARCHAR(100),
  budget_level VARCHAR(50),
  luxury_level VARCHAR(50),
  preferred_brand VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_preferences_lead ON lead_preferences(lead_id);

CREATE TABLE IF NOT EXISTS lead_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  room VARCHAR(100),
  work_type VARCHAR(100),
  priority VARCHAR(50),
  estimated_budget NUMERIC(12,2),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_requirements_lead ON lead_requirements(lead_id);
-- Migration: 046_alter_tasks_and_documents.sql

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE documents ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_docs_lead ON documents(lead_id);
-- Migration: 047_intelligence_tables.sql

CREATE TABLE IF NOT EXISTS lead_scores_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  buying_intent INTEGER,
  budget_score INTEGER,
  engagement_score INTEGER,
  response_score INTEGER,
  risk_score INTEGER,
  competition_score INTEGER,
  timeline_score INTEGER,
  overall_score INTEGER,
  calculated_by UUID REFERENCES users(id),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_score_history_lead ON lead_scores_history(lead_id);

CREATE TABLE IF NOT EXISTS lead_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  summary TEXT,
  sentiment VARCHAR(50),
  buying_intent VARCHAR(50),
  next_action TEXT,
  predicted_close_date DATE,
  predicted_revenue NUMERIC(12,2),
  risk_level VARCHAR(50),
  objections TEXT,
  confidence INTEGER,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  competitor VARCHAR(255),
  pricing NUMERIC(12,2),
  customer_feedback TEXT,
  lost_reason TEXT,
  won_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Migration: 048_event_timeline.sql

CREATE TABLE IF NOT EXISTS lead_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id UUID,
  summary TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_lead ON lead_timeline(lead_id);
CREATE INDEX IF NOT EXISTS idx_timeline_tenant_date ON lead_timeline(tenant_id, created_at DESC);
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS suggested_followup_at TIMESTAMP WITH TIME ZONE;
-- Migration: 049_indexes_and_extensions.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Core performance indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_assigned ON leads(tenant_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON leads(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created ON leads(tenant_id, created_at);

-- Fuzzy search indexes using pg_trgm
CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON leads USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);
-- Migration: 050_automation_events.sql

CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  workflow VARCHAR(255),
  trigger_type VARCHAR(100),
  action_type VARCHAR(100),
  status VARCHAR(50),
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_ms INTEGER,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_automation_events_lead ON automation_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_tenant_date ON automation_events(tenant_id, executed_at DESC);
-- Migration: 051_referral_system.sql

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  referred_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  reward VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(referrer_lead_id, referred_lead_id)
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_lead_id);
-- Migration: 052_materialized_views.sql

DROP MATERIALIZED VIEW IF EXISTS pipeline_summary CASCADE;

CREATE MATERIALIZED VIEW pipeline_summary AS
SELECT 
    tenant_id,
    stage_id,
    COUNT(id) as total_leads,
    AVG(score) as average_score,
    COALESCE(SUM(budget_max), 0) as total_pipeline_value
FROM leads
WHERE deleted_at IS NULL
GROUP BY tenant_id, stage_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_summary_tenant_stage ON pipeline_summary(tenant_id, stage_id);

CREATE OR REPLACE FUNCTION refresh_pipeline_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pipeline_summary;
END;
$$ LANGUAGE plpgsql;

-- Migration: 054_add_mfa_to_users.sql
-- Add MFA fields to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
-- Migration: 055_audit_immutability.sql
-- Description: Enforces immutability on the audit_logs table via database triggers.

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

-- Check if trigger exists, drop and recreate it for idempotency
DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
-- Migration: 056_boq_and_quotations.sql
-- Description: Adds robust Quotation and Bill of Quantities (BOQ) support, and links site visits to projects.

-- 1. Add project_id to site_visits
ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- 2. Create Quotations Table
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  quotation_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, accepted, rejected, revised
  version INTEGER DEFAULT 1,
  
  -- Totals
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  
  notes TEXT,
  terms_conditions TEXT,
  valid_until TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project ON quotations(project_id);

-- 3. Create Quotation Items Table (Bill of Quantities / BOQ)
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE NOT NULL,
  
  -- Hierarchical BOQ support (e.g. Living Room -> Sofa -> Fabric)
  parent_item_id UUID REFERENCES quotation_items(id) ON DELETE CASCADE,
  
  room_or_area VARCHAR(100), -- Optional categorizer
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pricing & Measurement
  unit VARCHAR(50), -- SqFt, Rft, Nos, etc.
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  markup_percentage NUMERIC(5,2) DEFAULT 0, -- For margin tracking
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price * (1 + (markup_percentage / 100))) STORED,
  
  -- Execution metadata
  material_specifications TEXT,
  brand VARCHAR(100),
  
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);
-- Migration: 057_leads_performance_indexes.sql

-- Add indexes for score and updated_at as they are frequently used in filtering and sorting
CREATE INDEX IF NOT EXISTS idx_leads_tenant_score ON leads(tenant_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_updated_at ON leads(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status ON leads(tenant_id, status);
-- Migration: 058_leads_tags.sql

ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING gin (tags);
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
-- Migration: 060_partners.sql

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id SERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- e.g., 'Contractor', 'Architect', 'Material Supplier'
  name VARCHAR(255) NOT NULL,
  rating NUMERIC(3, 1) DEFAULT 0.0,
  completed_projects INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_tenant ON marketplace_partners(tenant_id);
-- Add wip_limit to lead_stages to restrict the number of active leads in a stage
ALTER TABLE lead_stages
ADD COLUMN IF NOT EXISTS wip_limit INTEGER DEFAULT NULL;
-- Migration: 062_lead_sentiment_history.sql

CREATE TABLE IF NOT EXISTS lead_sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sentiment VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_sentiment_history ON lead_sentiment_history(lead_id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS booking_amount DECIMAL(12,2) DEFAULT 0.00;
-- Migration: 064_alter_documents_version_to_integer.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'documents' 
      AND column_name = 'version' 
      AND data_type = 'boolean'
  ) THEN
    ALTER TABLE documents ALTER COLUMN version DROP DEFAULT;
    ALTER TABLE documents ALTER COLUMN version TYPE INTEGER USING (CASE WHEN version IS FALSE THEN 0 WHEN version IS TRUE THEN 1 ELSE 1 END);
    ALTER TABLE documents ALTER COLUMN version SET DEFAULT 1;
  END IF;
END $$;
-- Migration: 065_add_scope_lock_and_execution_phase.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_scope_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS is_execution BOOLEAN DEFAULT FALSE;

-- Update existing project_phases to mark execution phases
UPDATE project_phases 
SET is_execution = TRUE 
WHERE LOWER(name) NOT LIKE '%design%' 
  AND LOWER(name) NOT LIKE '%measurement%' 
  AND LOWER(name) NOT LIKE '%plan%' 
  AND LOWER(name) NOT LIKE '%draft%'
  AND LOWER(name) NOT LIKE '%concept%';
-- Migration: 066_add_client_agreement_signoff_fields.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signed_by VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agreement_signature_method VARCHAR(50);
-- Migration: 067_add_payment_terms_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50);
-- Migration: 068_add_structured_address_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS flat_number VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS floor VARCHAR(50);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS building_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS landmark VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Backfill existing site_address into street if street is currently null
UPDATE projects
SET street = site_address
WHERE site_address IS NOT NULL 
  AND flat_number IS NULL 
  AND floor IS NULL 
  AND building_name IS NULL 
  AND street IS NULL 
  AND city IS NULL 
  AND pincode IS NULL 
  AND landmark IS NULL;

-- Trigger to keep site_address updated if structured address is modified
CREATE OR REPLACE FUNCTION sync_project_site_address()
RETURNS TRIGGER AS $$
DECLARE
  parts TEXT[] := '{}';
  has_structured BOOLEAN := FALSE;
BEGIN
  IF NEW.flat_number IS NOT NULL AND TRIM(NEW.flat_number) != '' THEN
    parts := array_append(parts, TRIM(NEW.flat_number));
    has_structured := TRUE;
  END IF;
  IF NEW.floor IS NOT NULL AND TRIM(NEW.floor) != '' THEN
    parts := array_append(parts, TRIM(NEW.floor));
    has_structured := TRUE;
  END IF;
  IF NEW.building_name IS NOT NULL AND TRIM(NEW.building_name) != '' THEN
    parts := array_append(parts, TRIM(NEW.building_name));
    has_structured := TRUE;
  END IF;
  IF NEW.street IS NOT NULL AND TRIM(NEW.street) != '' THEN
    parts := array_append(parts, TRIM(NEW.street));
    has_structured := TRUE;
  END IF;
  IF NEW.landmark IS NOT NULL AND TRIM(NEW.landmark) != '' THEN
    parts := array_append(parts, TRIM(NEW.landmark));
    has_structured := TRUE;
  END IF;
  IF NEW.city IS NOT NULL AND TRIM(NEW.city) != '' THEN
    parts := array_append(parts, TRIM(NEW.city));
    has_structured := TRUE;
  END IF;
  IF NEW.pincode IS NOT NULL AND TRIM(NEW.pincode) != '' THEN
    parts := array_append(parts, TRIM(NEW.pincode));
    has_structured := TRUE;
  END IF;

  IF has_structured THEN
    NEW.site_address := array_to_string(parts, ', ');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_project_site_address ON projects;
CREATE TRIGGER trg_sync_project_site_address
BEFORE INSERT OR UPDATE OF flat_number, floor, building_name, street, city, pincode, landmark ON projects
FOR EACH ROW
EXECUTE FUNCTION sync_project_site_address();
-- Migration: 069_add_builder_society_info_to_projects.sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS builder_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS society_name VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rera_id VARCHAR(100);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS noc_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS occupancy_certificate_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_handover_date DATE;
-- Migration: 070_add_project_contacts.sql
CREATE TABLE IF NOT EXISTS project_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  role VARCHAR(100),               -- e.g., 'co_owner', 'spouse', 'architect', 'builder_representative', 'legal'
  decision_authority VARCHAR(50),  -- e.g., 'Primary', 'Influencer', 'Consultant'
  relationship_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project ON project_contacts(project_id);
-- Migration: 071_add_project_measurements.sql
-- Description: Adds overall project measurement fields and room-wise site measurements.

-- 1. Add overall project measurement fields
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS carpet_area NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS built_up_area NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_rooms INTEGER DEFAULT 0;

-- 2. Create project room measurements table
CREATE TABLE IF NOT EXISTS project_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  length NUMERIC(10, 2) DEFAULT 0,
  width NUMERIC(10, 2) DEFAULT 0,
  height NUMERIC(10, 2) DEFAULT 0,
  area NUMERIC(10, 2) DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'feet',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create index for fast retrieval of project measurements
CREATE INDEX IF NOT EXISTS idx_project_measurements_project ON project_measurements(project_id);
-- Migration: 072_add_project_category_and_nature.sql
-- Description: Adds classification fields for project category, sub-category, property type, property age, renovation scope, and segment.

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS project_sub_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS property_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS property_age VARCHAR(50),
ADD COLUMN IF NOT EXISTS renovation_scope VARCHAR(100),
ADD COLUMN IF NOT EXISTS segment VARCHAR(50);
-- Migration: 073_add_project_vendors_and_consultants.sql
-- Description: Adds tables for project level vendors and external consultants.

CREATE TABLE IF NOT EXISTS project_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  scope_of_work TEXT,
  agreed_rate DECIMAL(12, 2),
  payment_terms TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_vendors_project ON project_vendors(project_id);

CREATE TABLE IF NOT EXISTS project_consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  firm VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_consultants_project ON project_consultants(project_id);
-- Migration: 074_add_project_design_requirements.sql
-- Description: Adds tables for project-level design requirements, room-by-room requirements, and inspirations.

CREATE TABLE IF NOT EXISTS project_design_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  interior_style VARCHAR(255),
  color_theme VARCHAR(255),
  material_preference TEXT,
  kitchen_style VARCHAR(255),
  wardrobe_style VARCHAR(255),
  lighting_preference TEXT,
  flooring_preference TEXT,
  lifestyle_inputs TEXT,
  must_haves TEXT,
  nice_to_haves TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_design_requirements UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_proj_design_reqs_project ON project_design_requirements(project_id);

CREATE TABLE IF NOT EXISTS project_room_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  budget_allocation DECIMAL(12,2),
  priority VARCHAR(50),
  functional_requirements TEXT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proj_room_reqs_project ON project_room_requirements(project_id);

CREATE TABLE IF NOT EXISTS project_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  room_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_inspirations_project ON project_inspirations(project_id);
-- Migration: 075_design_assets.sql
-- Description: Adds tables for design assets (mood boards, concept presentations, and reference collections) and tracks client feedback/approvals.

CREATE TABLE IF NOT EXISTS design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  asset_type VARCHAR(50) NOT NULL, -- 'mood_board', 'concept_board', 'reference_collection'
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending_approval', 'approved', 'revision_requested'
  is_visible_to_client BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_approved_at TIMESTAMP,
  client_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_assets_project ON design_assets(project_id);

CREATE TABLE IF NOT EXISTS design_asset_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  design_asset_id UUID NOT NULL REFERENCES design_assets(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  title VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_asset_items_asset ON design_asset_items(design_asset_id);
-- Migration: 076_design_review_workflow.sql
-- Description: Adds schema for structured 2D/3D design reviews including named rounds, item-level client comments, and round tracking.

CREATE TABLE IF NOT EXISTS design_review_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- 'Round 1', 'Round 2', 'Final', etc.
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed'
  decision_note TEXT,
  client_reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_review_rounds_project ON design_review_rounds(project_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS design_review_round_id UUID REFERENCES design_review_rounds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_docs_review_round ON documents(design_review_round_id);

CREATE TABLE IF NOT EXISTS design_item_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_by_client BOOLEAN DEFAULT FALSE,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_design_item_comments_doc ON design_item_comments(document_id);
-- Migration: 077_material_palettes.sql
-- Description: Adds schema for tracking color schemes and material palettes per room/category with client approval states.

CREATE TABLE IF NOT EXISTS project_material_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL, -- e.g., 'Living Room', 'Kitchen', 'Master Bedroom'
  item_name VARCHAR(255) NOT NULL, -- e.g., 'Wall Paint', 'Primary Laminate', 'Cabinet Hardware'
  brand VARCHAR(255),              -- e.g., 'Asian Paints', 'CenturyPly', 'Hafele'
  shade_code VARCHAR(100),         -- e.g., 'AP-9234', 'Golden Oak 823'
  finish VARCHAR(100),             -- e.g., 'Matte', 'High Gloss', 'Satin'
  image_url TEXT,                  -- Optional swatch/preview image or base64
  status VARCHAR(50) DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'revision_requested'
  client_feedback TEXT,
  client_approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_palettes_project ON project_material_palettes(project_id);
-- Migration: 078_add_project_revision_limits.sql
-- Description: Adds configuration for allowed design revisions, counts current revisions, and creates a Change Orders table.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS allowed_design_revisions INTEGER DEFAULT 3;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS current_design_revisions INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS project_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project ON project_change_orders(project_id);
-- Migration: 079_boq_version_control.sql
-- Description: Adds change_reason column to quotations and item_key column to quotation_items for comparison tracking.

-- 1. Add change_reason to quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- 2. Add item_key to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS item_key UUID DEFAULT gen_random_uuid();

-- 3. Backfill item_key for any existing rows that might be NULL
UPDATE quotation_items 
SET item_key = gen_random_uuid() 
WHERE item_key IS NULL;
-- Migration: 080_boq_scope_tracking.sql
-- Description: Adds scope tracking columns (scope_type, change_order_id) to quotation_items.

ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) DEFAULT 'original' NOT NULL CHECK (scope_type IN ('original', 'addition', 'reduction')),
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES project_change_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quotation_items_change_order ON quotation_items(change_order_id);
-- Migration: 081_boq_client_acceptance.sql
-- Description: Adds accepted_at column to quotations to record client confirmation date.

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;
-- Migration: 082_project_budget_tracking.sql
-- Description: Adds tables for project budget and expense tracking.

CREATE TABLE IF NOT EXISTS project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('labour', 'material', 'vendor')),
  budgeted_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_budget_category UNIQUE (project_id, category, tenant_id)
);

CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('labour', 'material', 'vendor')),
  type VARCHAR(50) NOT NULL CHECK (type IN ('committed', 'actual')),
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  incurred_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_budgets_project ON project_budgets(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id, tenant_id);
-- Migration: 083_boq_tax_breakdown.sql
-- Description: Adds GST breakdown columns to quotations and quotation_items.

-- 1. Add GST type and totals to quotations
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
ADD COLUMN IF NOT EXISTS cgst_total DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_total DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS igst_total DECIMAL(12,2) DEFAULT 0.00;

-- 2. Add HSN, GST rate, and split columns to quotation_items
ALTER TABLE quotation_items
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS cgst_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sgst_amount DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS igst_amount DECIMAL(12,2) DEFAULT 0.00;
-- Migration: 084_purchase_orders.sql
-- Description: Adds tables for Purchase Order (PO) system and links them to project vendors and budget expenses.

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  po_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'partially received', 'received', 'cancelled')),
  expected_delivery_date TIMESTAMP,
  notes TEXT,
  terms_conditions TEXT,
  total_amount DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_order_number UNIQUE (tenant_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_project ON purchase_orders(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  brand VARCHAR(100),
  material_specifications TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id, tenant_id);

-- Add purchase_order_id column to project_expenses so we can link them
ALTER TABLE project_expenses
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_expenses_po ON project_expenses(purchase_order_id);
-- Migration: 085_material_deliveries.sql
-- Description: Adds tables for Material Delivery and Goods Receipt tracking system.

CREATE TABLE IF NOT EXISTS material_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  delivery_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'inspected', 'partially received', 'rejected')),
  expected_delivery_date TIMESTAMP,
  actual_receipt_date TIMESTAMP,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_material_delivery_number UNIQUE (tenant_id, delivery_number)
);

CREATE INDEX IF NOT EXISTS idx_material_deliveries_project ON material_deliveries(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_deliveries_po ON material_deliveries(purchase_order_id);

CREATE TABLE IF NOT EXISTS material_delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  material_delivery_id UUID NOT NULL REFERENCES material_deliveries(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity_expected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  quantity_received DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_damaged BOOLEAN DEFAULT FALSE,
  damage_description TEXT,
  condition_notes TEXT,
  photo_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_md_items_delivery ON material_delivery_items(material_delivery_id, tenant_id);
-- Migration: 086_vendor_payments.sql
-- Description: Adds tables for Vendor Payment Tracking system.

CREATE TABLE IF NOT EXISTS vendor_payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES project_vendors(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  material_delivery_id UUID REFERENCES material_deliveries(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  percentage DECIMAL(5, 2),
  due_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'partially paid', 'paid', 'overdue')),
  paid_amount DECIMAL(12, 2) DEFAULT 0.00,
  paid_at DATE,
  invoice_reference VARCHAR(255),
  payment_method VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_payments_project ON vendor_payment_milestones(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_payment_milestones(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_po ON vendor_payment_milestones(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_status ON vendor_payment_milestones(tenant_id, status);
-- Migration: 087_material_substitutions.sql
-- Description: Adds tables for Material Shortage and Substitution workflow.

CREATE TABLE IF NOT EXISTS material_substitutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  boq_item_id UUID NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason_shortage TEXT NOT NULL,
  replacement_item_name VARCHAR(255) NOT NULL,
  replacement_brand VARCHAR(100),
  replacement_material_specifications TEXT,
  replacement_unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  price_difference DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  client_approval_status VARCHAR(50) DEFAULT 'pending' CHECK (client_approval_status IN ('pending', 'approved', 'rejected')),
  client_approved_at TIMESTAMP,
  client_feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_substitutions_project ON material_substitutions(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_material_substitutions_item ON material_substitutions(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_material_substitutions_status ON material_substitutions(tenant_id, status);
-- Migration: 088_production_orders.sql
-- Description: Adds tables for Production Order system to track item-wise production schedules, factory assignments, QC status, packaging, and dispatch dates.

CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  order_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'in_production', 'completed', 'cancelled')),
  factory_name VARCHAR(255),
  expected_completion_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_order_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_project ON production_orders(project_id, tenant_id);

CREATE TABLE IF NOT EXISTS production_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  factory_assignment VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed', 'cancelled')),
  production_start_date TIMESTAMP,
  production_complete_date TIMESTAMP,
  qc_status VARCHAR(50) DEFAULT 'pending' CHECK (qc_status IN ('pending', 'passed', 'failed')),
  packaging_status VARCHAR(50) DEFAULT 'pending' CHECK (packaging_status IN ('pending', 'packaged', 'dispatched')),
  dispatch_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_items_order ON production_order_items(production_order_id, tenant_id);
-- Migration: 089_production_qc.sql
-- Description: Adds tables for Factory Quality Control (QC) Inspections, Rework Orders, and updates production orders with dispatch clearance fields.

-- 1. Create QC Inspections Table
CREATE TABLE IF NOT EXISTS production_qc_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('passed', 'failed')),
  notes TEXT,
  photo_keys TEXT DEFAULT '[]', -- JSON array of S3 photo keys
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_item ON production_qc_inspections(production_order_item_id, tenant_id);

-- 2. Create Rework Orders Table
CREATE TABLE IF NOT EXISTS production_rework_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  qc_inspection_id UUID REFERENCES production_qc_inspections(id) ON DELETE SET NULL,
  rework_number VARCHAR(100) NOT NULL,
  rework_instructions TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'verified')),
  assigned_to VARCHAR(255),
  target_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_rework_order_number UNIQUE (tenant_id, rework_number)
);

CREATE INDEX IF NOT EXISTS idx_rework_orders_item ON production_rework_orders(production_order_item_id, tenant_id);

-- 3. Add dispatch clearance columns to production_orders
ALTER TABLE production_orders
ADD COLUMN IF NOT EXISTS is_cleared_for_dispatch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cleared_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;
-- Migration: 090_production_dispatch.sql
-- Description: Adds tables for Dispatch Tracking and Transport Logistics.

CREATE TABLE IF NOT EXISTS production_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  dispatch_number VARCHAR(100) NOT NULL,
  dispatch_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  vehicle_number VARCHAR(100),
  driver_name VARCHAR(255),
  driver_contact VARCHAR(100),
  expected_delivery_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'delivered', 'failed_delivery')),
  actual_delivery_date TIMESTAMP,
  received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  received_by_name VARCHAR(255),
  receipt_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_dispatch_number UNIQUE (tenant_id, dispatch_number)
);

CREATE INDEX IF NOT EXISTS idx_production_dispatches_order ON production_dispatches(production_order_id, tenant_id);
-- Migration: 091_transit_damage.sql
-- Description: Adds tables for Transit Damage Tracking.

CREATE TABLE IF NOT EXISTS production_transit_damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_dispatch_id UUID NOT NULL REFERENCES production_dispatches(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  damage_number VARCHAR(100) NOT NULL,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  quantity_damaged DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  damage_severity VARCHAR(50) NOT NULL CHECK (damage_severity IN ('minor', 'major', 'critical')),
  liability_type VARCHAR(50) DEFAULT 'undetermined' CHECK (liability_type IN ('transporter', 'vendor', 'insurance_claim', 'undetermined')),
  status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'claim_filed', 'replacement_initiated', 'resolved')),
  description TEXT NOT NULL,
  photo_keys TEXT DEFAULT '[]', -- JSON array of photo keys
  replacement_order_id UUID REFERENCES production_orders(id) ON DELETE SET NULL,
  resolution_timeline TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_transit_damage_number UNIQUE (tenant_id, damage_number)
);

CREATE INDEX IF NOT EXISTS idx_transit_damage_dispatch ON production_transit_damages(production_dispatch_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_transit_damage_item ON production_transit_damages(production_order_item_id, tenant_id);
-- Migration: 092_trade_work_activities.sql
-- Description: Creates trade work activity templates and project work activity tracking tables.

-- 1. Create trade activity templates table
CREATE TABLE IF NOT EXISTS trade_activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade VARCHAR(50) NOT NULL, -- civil, electrical, plumbing, false_ceiling, flooring, painting, carpentry, glass, soft_furnishing
  room_type VARCHAR(50) NOT NULL DEFAULT 'General', -- General, Kitchen, Bedroom, Bathroom, Living Room
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create project work activities table
CREATE TABLE IF NOT EXISTS project_work_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  room_name VARCHAR(100) NOT NULL, -- Room/area of the project, e.g. 'Living Room', 'Master Bedroom'
  trade VARCHAR(50) NOT NULL, -- civil, electrical, plumbing, false_ceiling, flooring, painting, carpentry, glass, soft_furnishing
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  due_date DATE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proj_work_act_proj ON project_work_activities(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_proj_work_act_phase ON project_work_activities(phase_id, tenant_id);

-- 4. Seed default trade-wise activity templates
INSERT INTO trade_activity_templates (trade, room_type, activity_name, description, sort_order) VALUES
-- Civil Templates
('civil', 'General', 'Demolition and hacking', 'Demolition of existing structures, walls, or tiles.', 10),
('civil', 'General', 'Debris removal & site cleaning', 'Clearing out debris and preparing the floor/walls.', 20),
('civil', 'General', 'Brickwork & partition construction', 'Constructing new walls or block partitions.', 30),
('civil', 'General', 'Internal wall plastering', 'Applying cement plaster coat to align walls.', 40),
('civil', 'Bathroom', 'Floor hacking and base leveling', 'Hacking existing floor, readying for plumbing.', 50),
('civil', 'Bathroom', 'Floor screeding and slope check', 'Providing screed bed and checking drainage slope.', 60),

-- Electrical Templates
('electrical', 'General', 'Electrical switch layout marking', 'Marking point positions for sockets, switches, and conduits.', 10),
('electrical', 'General', 'Wall chasing and conduit pipe laying', 'Cutting grooves in walls and fitting PVC conduit pipes.', 20),
('electrical', 'General', 'Concealed metal backbox fixing', 'Fixing metal GI switchboxes in walls.', 30),
('electrical', 'General', 'Wire pulling and cable routing', 'Routing wires through conduits for mains, lighting, and power.', 40),
('electrical', 'General', 'Distribution board & MCB dressing', 'Installing the DB box, MCBs, and dressing connections.', 50),
('electrical', 'General', 'Switchboard modular plates mounting', 'Fixing switches, sockets, and plates to switchboxes.', 60),
('electrical', 'General', 'Light fittings and fans installation', 'Mounting ceiling lights, wall lamps, spot lights, and fans.', 70),

-- Plumbing Templates
('plumbing', 'Bathroom', 'Wall pipe chasing and layout', 'Chasing bathroom walls for hot/cold water pipes.', 10),
('plumbing', 'Bathroom', 'Drainage and waste pipe fitting', 'Laying down drain lines, traps, and waste outlets.', 20),
('plumbing', 'Bathroom', 'Waterproofing base coat application', 'Applying waterproofing compounds on floors and wet walls.', 30),
('plumbing', 'Bathroom', 'Sanitaryware & CP fittings installation', 'Installing water closets, wash basins, showers, and faucets.', 40),
('plumbing', 'Kitchen', 'Sink inlet & outlet pipe connection', 'Connecting kitchen sink pipework and faucet fittings.', 50),

-- False Ceiling Templates
('false_ceiling', 'General', 'Ceiling framing & level marking', 'Marking levels on walls and installing GI steel frame grids.', 10),
('false_ceiling', 'General', 'Gypsum board boarding & fixing', 'Screwing gypsum plasterboards onto the steel frame.', 20),
('false_ceiling', 'General', 'Joint tape compound finish', 'Applying jointing tape and compound over gypsum board joints.', 30),
('false_ceiling', 'General', 'Light & spot cutouts cutting', 'Making circular or square cutouts for lights and LEDs.', 40),

-- Flooring Templates
('flooring', 'General', 'Subfloor cleaning and priming', 'Cleaning dust and applying primer/cement slurry.', 10),
('flooring', 'General', 'Tile / marble laying & leveling', 'Spreading mortar bed and laying tiles/stones with spacers.', 20),
('flooring', 'General', 'Grouting and joint filling', 'Filling tile joints with epoxy or cement grout.', 30),
('flooring', 'General', 'Skirting tile cutting and fixing', 'Fixing wall-border skirting tiles.', 40),
('flooring', 'General', 'Floor protection sheets overlay', 'Laying floor protection sheets to prevent scratch damage.', 50),

-- Painting Templates
('painting', 'General', 'Wall scraping & sanding prep', 'Scraping old paint, wallpaper, and sanding plaster.', 10),
('painting', 'General', 'Wall putty application - Coat 1', 'Applying first base coat of acrylic wall putty.', 20),
('painting', 'General', 'Wall putty & sanding - Coat 2', 'Applying second coat of putty and fine sanding.', 30),
('painting', 'General', 'Wall primer coat application', 'Applying acrylic water-based wall primer.', 40),
('painting', 'General', 'Premium emulsion paint - Coat 1', 'Applying first finish coat of interior emulsion.', 50),
('painting', 'General', 'Premium emulsion paint - Coat 2', 'Applying second/final finish coat of paint.', 60),

-- Carpentry Templates
('carpentry', 'Kitchen', 'Modular base cabinet carcass assembly', 'Assembling and leveling kitchen base modular units.', 10),
('carpentry', 'Kitchen', 'Modular wall cabinet carcass mounting', 'Mounting wall units and adjusting overhead heights.', 20),
('carpentry', 'Bedroom', 'Wardrobe carcass assembly & fixing', 'Assembling bedroom wardrobe framing and shelves.', 30),
('carpentry', 'General', 'Laminate / veneer sheet pressing', 'Applying adhesives and pressing laminates or veneer.', 40),
('carpentry', 'General', 'Shutters hinges & soft-close adjustment', 'Hanging cabinet doors and adjusting auto-hinges.', 50),
('carpentry', 'General', 'Hardware accessories & handles fixing', 'Fixing handles, drawers runners, pullouts, and baskets.', 60),

-- Glass Templates
('glass', 'Bathroom', 'Shower partition template measurement', 'Taking exact template sizes for toughened shower glass.', 10),
('glass', 'Bathroom', 'Shower glass panel installation', 'Fixing U-channel profiles and mounting toughened glass.', 20),
('glass', 'Bathroom', 'Mirror mounting & back-lit wiring', 'Installing dressing and bathroom wall mirrors.', 30),
('glass', 'General', 'Glass shelves & shutters installation', 'Fitting glass shelving and glass cabinet shutters.', 40),

-- Soft Furnishing Templates
('soft_furnishing', 'Living Room', 'Curtain track mounting', 'Installing channel tracks or rods to ceiling/walls.', 10),
('soft_furnishing', 'Bedroom', 'Window blinds / roller blinds installation', 'Mounting bracket system and roller blinds.', 20),
('soft_furnishing', 'General', 'Wallpaper application prep and fixing', 'Sizing wallpaper sheets and gluing them onto walls.', 30);
-- Migration: 093_site_readiness_checklist.sql
-- Description: Creates project site readiness checklist table.

CREATE TABLE IF NOT EXISTS project_site_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  photo_key VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_readiness_item UNIQUE (project_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_project_readiness_proj ON project_site_readiness(project_id, tenant_id);
-- Migration: 094_task_dependencies.sql
-- Description: Creates task_dependencies table and adds enforce_dependencies flag to projects.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS enforce_dependencies BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'finish-to-start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_task_dependency UNIQUE (task_id, depends_on_task_id),
  CONSTRAINT chk_self_dependency CHECK (task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dep_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_proj ON task_dependencies(project_id);
-- Migration: 095_daily_site_reports.sql
-- Description: Creates daily_site_reports table.

CREATE TABLE IF NOT EXISTS daily_site_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  work_done TEXT NOT NULL,
  manpower JSONB NOT NULL DEFAULT '[]',
  materials JSONB NOT NULL DEFAULT '[]',
  issues_encountered TEXT,
  photos JSONB NOT NULL DEFAULT '[]',
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_report_date UNIQUE (project_id, report_date),
  CONSTRAINT chk_mandatory_photos CHECK (jsonb_array_length(photos) > 0)
);

CREATE INDEX IF NOT EXISTS idx_dsr_project ON daily_site_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_dsr_tenant ON daily_site_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dsr_project_date ON daily_site_reports(project_id, report_date);
-- Migration: 096_room_completion_tracking.sql
-- Description: Adds room_name column to the tasks table for room-wise completion tracking.

-- 1. Add room_name column to tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS room_name VARCHAR(100);

-- 2. Create index for performance on room-wise lookups
CREATE INDEX IF NOT EXISTS idx_tasks_project_room ON tasks(project_id, room_name);
-- Migration: 097_task_start_date_and_duration.sql
-- Description: Adds start_date and duration_days columns to the tasks table for task scheduling.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 1;

-- Backfill: Set start_date = COALESCE(due_date, project's start_date, CURRENT_DATE)
UPDATE tasks t
SET start_date = COALESCE(t.due_date, p.start_date, CURRENT_DATE)
FROM projects p
WHERE t.project_id = p.id AND t.start_date IS NULL;

-- Backfill tasks not associated with a project (e.g. lead tasks)
UPDATE tasks
SET start_date = COALESCE(due_date, CURRENT_DATE)
WHERE start_date IS NULL;

-- Backfill: Ensure due_date is at least start_date
UPDATE tasks
SET due_date = start_date
WHERE due_date IS NULL OR due_date < start_date;

-- Backfill: Set duration_days based on dates
UPDATE tasks
SET duration_days = GREATEST(1, due_date - start_date + 1)
WHERE start_date IS NOT NULL AND due_date IS NOT NULL;
-- Migration: 098_project_schedule_revisions.sql
-- Description: Adds baseline date columns to projects and tasks, and creates project_schedule_revisions table.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baseline_target_date DATE;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS baseline_due_date DATE;

-- If any active projects exist, populate their baselines with current start/target dates
UPDATE projects
SET baseline_start_date = start_date,
    baseline_target_date = target_date
WHERE status = 'active' AND baseline_start_date IS NULL;

-- Populate task baselines for active projects
UPDATE tasks t
SET baseline_start_date = t.start_date,
    baseline_due_date = t.due_date
FROM projects p
WHERE t.project_id = p.id AND p.status = 'active' AND t.baseline_start_date IS NULL;

CREATE TABLE IF NOT EXISTS project_schedule_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revised_by UUID REFERENCES users(id) ON DELETE SET NULL,
  revised_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  previous_start_date DATE,
  previous_target_date DATE,
  new_start_date DATE,
  new_target_date DATE,
  reason TEXT NOT NULL,
  revision_number INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_sched_rev_proj ON project_schedule_revisions(project_id);
-- Migration: 099_add_resource_workload_fields.sql
-- Description: Adds weekly_capacity to users and pm/designer hours allocations to projects

-- Add weekly_capacity to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_capacity INTEGER DEFAULT 40;

-- Add pm_hours_allocated and designer_hours_allocated to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_hours_allocated INTEGER DEFAULT 10;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS designer_hours_allocated INTEGER DEFAULT 20;
-- Migration: 100_add_project_site_team.sql
-- Description: Adds project_site_team table for contractor and labour tracking.

CREATE TABLE IF NOT EXISTS project_site_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  role VARCHAR(100) NOT NULL, -- carpenter, electrician, plumber, painter, supervisor, other
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active', -- active, inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_site_team_project ON project_site_team(project_id);
-- Migration: 101_add_project_resource_handovers.sql
-- Description: Adds project_resource_handovers table for PM and designer handover logs.

CREATE TABLE IF NOT EXISTS project_resource_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- pm, designer
  replaced_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handover_notes TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_resource_handovers_project ON project_resource_handovers(project_id);
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  meeting_date TIMESTAMP NOT NULL,
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  agenda TEXT,
  discussion_points TEXT,
  decisions TEXT,
  client_sign_off_status VARCHAR(50) DEFAULT 'pending', -- pending, signed_off
  client_signed_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_notes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  due_date DATE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_project ON meeting_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items(meeting_id);
-- Migration: 103_add_client_fields_to_site_visits.sql
-- Description: Adds client_invited and client_feedback columns to site_visits table.

ALTER TABLE site_visits 
ADD COLUMN IF NOT EXISTS client_invited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS client_feedback TEXT;
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
-- Migration: 105_change_order_module.sql
-- Description: Enhances project_change_orders table with reason, timeline impact, client signature, and updates status values.

-- 1. Add columns for reason, timeline_impact_days, client_signature, and client_signed_at
ALTER TABLE project_change_orders 
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS timeline_impact_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_signature TEXT,
ADD COLUMN IF NOT EXISTS client_signed_at TIMESTAMP;

-- 2. Update existing rows where status is 'pending' to 'submitted'
UPDATE project_change_orders
SET status = 'submitted'
WHERE status = 'pending';

-- 3. Change default status to 'draft'
ALTER TABLE project_change_orders
ALTER COLUMN status SET DEFAULT 'draft';
-- Migration: 106_material_substitution_trail.sql
-- Description: Adds original specifications and client sign-off fields to material_substitutions table.

ALTER TABLE material_substitutions
  ADD COLUMN IF NOT EXISTS original_item_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS original_brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS original_material_specifications TEXT,
  ADD COLUMN IF NOT EXISTS original_unit_price DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS client_signoff_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS client_signature_data TEXT;
-- Migration: 106_post_freeze_design_changes.sql
-- Description: Adds specific impact fields for post-freeze design changes to change orders.

ALTER TABLE project_change_orders
ADD COLUMN IF NOT EXISTS design_cost NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS material_impact TEXT,
ADD COLUMN IF NOT EXISTS procurement_impact TEXT;
-- Migration: 107_invoice_generation.sql
-- Description: Create invoices table to track tax invoice details generated from payment milestones.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_milestone_id UUID UNIQUE REFERENCES payment_milestones(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Billing (Client/Buyer) info
  billing_name VARCHAR(255) NOT NULL,
  billing_address TEXT,
  billing_gstin VARCHAR(50),
  
  -- Company (Seller) info
  company_name VARCHAR(255) NOT NULL,
  company_address TEXT,
  company_gstin VARCHAR(50),
  
  -- Price Breakdown
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  cgst_amount DECIMAL(12,2) DEFAULT 0.00,
  sgst_amount DECIMAL(12,2) DEFAULT 0.00,
  igst_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  payment_terms VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  pdf_storage_key VARCHAR(500),
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_number ON invoices(tenant_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_milestone ON invoices(payment_milestone_id);
-- Add fields for formal project pause and resume workflow
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS resource_release_instructions TEXT,
ADD COLUMN IF NOT EXISTS site_security_plan TEXT;
-- Migration: 108_credits_and_refunds.sql
-- Description: Create credit_notes and refunds tables to manage deductions, credits, and customer refunds.

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number VARCHAR(100) NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gst_type VARCHAR(50) DEFAULT 'cgst_sgst' CHECK (gst_type IN ('cgst_sgst', 'igst')),
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  cgst_amount DECIMAL(12,2) DEFAULT 0.00,
  sgst_amount DECIMAL(12,2) DEFAULT 0.00,
  igst_amount DECIMAL(12,2) DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'issued' CHECK (status IN ('issued', 'void')),
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payment_milestone_id UUID REFERENCES payment_milestones(id) ON DELETE SET NULL,
  refund_number VARCHAR(100) NOT NULL,
  refund_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  reference_number VARCHAR(100),
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'void')),
  
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_notes_number ON credit_notes(tenant_id, credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_project ON credit_notes(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_number ON refunds(tenant_id, refund_number);
CREATE INDEX IF NOT EXISTS idx_refunds_project ON refunds(project_id);
-- Migration: 109_add_tds_to_payment_milestones.sql
-- Description: Add tds_rate and tds_amount columns to payment_milestones table.

ALTER TABLE payment_milestones 
  ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12,2) DEFAULT 0.00;
-- Migration: 110_alter_budget_expense_category.sql
-- Description: Alter check constraints on project_budgets and project_expenses to add 'overhead'.

ALTER TABLE project_budgets DROP CONSTRAINT IF EXISTS project_budgets_category_check;
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_category_check;

ALTER TABLE project_budgets ADD CONSTRAINT project_budgets_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead'));
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead'));
-- Migration: 111_drawing_register.sql
-- Description: Adds drawing_register table to track drawings, versions, revisions, issue dates, and status.

CREATE TABLE IF NOT EXISTS drawing_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_number VARCHAR(100) NOT NULL,
  revision_code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'issued_for_approval', 'issued_for_construction', 'superseded', 'issued_for_info'
  issued_date DATE NOT NULL,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_superseded BOOLEAN DEFAULT FALSE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id, drawing_number, revision_code)
);

CREATE INDEX IF NOT EXISTS idx_drawing_reg_project ON drawing_register(project_id);
CREATE INDEX IF NOT EXISTS idx_drawing_reg_number ON drawing_register(drawing_number);
-- Migration: 112_document_client_acknowledgment.sql
-- Description: Add columns for client document acknowledgment tracking.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_acknowledged_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_acknowledged_by VARCHAR(255);
-- Migration: 113_pre_installation_checklists.sql
-- Description: Adds qc_checklist column to project_work_activities for trade-wise checklists.

ALTER TABLE project_work_activities
ADD COLUMN IF NOT EXISTS qc_checklist JSONB DEFAULT '[]';
-- Migration: 114_punch_lists.sql
-- Description: Creates punch_lists and punch_list_items tables for pre-handover walkthroughs.

CREATE TABLE IF NOT EXISTS punch_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  walkthrough_date DATE,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'resolved', 'client_verified')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_off_by_client BOOLEAN DEFAULT false,
  client_signed_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id UUID NOT NULL REFERENCES punch_lists(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  trade VARCHAR(50) NOT NULL, -- carpentry, painting, electrical, plumbing, flooring, etc.
  item_description TEXT NOT NULL,
  photo_key VARCHAR(255),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'verified')),
  closed_by_qc UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMP,
  qc_notes TEXT,
  client_verified BOOLEAN DEFAULT false,
  client_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_punch_lists_project ON punch_lists(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_punch_list_items_list ON punch_list_items(punch_list_id);
-- Migration: 115_material_incoming_inspections.sql
-- Description: Adds incoming inspection workflow columns to material deliveries and items.

-- Alter material_deliveries table
ALTER TABLE material_deliveries
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS vendor_notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_notification_sent_at TIMESTAMP;

-- Alter material_delivery_items table
ALTER TABLE material_delivery_items
ADD COLUMN IF NOT EXISTS specification_conformance_status VARCHAR(50) DEFAULT 'conforming' CHECK (specification_conformance_status IN ('conforming', 'non-conforming')),
ADD COLUMN IF NOT EXISTS specification_variance_details TEXT,
ADD COLUMN IF NOT EXISTS inspection_status VARCHAR(50) DEFAULT 'pending' CHECK (inspection_status IN ('pending', 'accepted', 'rejected')),
ADD COLUMN IF NOT EXISTS rejected_quantity DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
-- Migration: 116_snag_rework_tracking.sql
-- Description: Adds rework tracking columns to the snags table.

ALTER TABLE snags
ADD COLUMN IF NOT EXISTS rework_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rework_root_cause_category VARCHAR(100) CHECK (rework_root_cause_category IN ('workmanship_error', 'material_defect', 'design_flaw', 'site_damage', 'vendor_fault', 'other')),
ADD COLUMN IF NOT EXISTS rework_estimated_hours DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_actual_hours DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_cost DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS rework_completed_at TIMESTAMP;
-- Migration: 117_handover_documentation.sql
-- Description: Adds columns to handover_items to track product manuals and warranties.

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'inspection',
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS warranty_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS has_manual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_warranty_card BOOLEAN DEFAULT false;
-- Migration: 118_handover_financial_keys.sql
-- Description: Adds columns to payment_milestones and handover_items for financial clearance and key handover.

ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS is_deferred BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deferral_reference VARCHAR(255);

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS key_details VARCHAR(255);
-- Migration: 119_warranty_module.sql
-- Description: Creates the warranties table for product-wise warranty tracking.

CREATE TABLE IF NOT EXISTS warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  handover_item_id UUID REFERENCES handover_items(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  serial_number VARCHAR(100),
  brand VARCHAR(100),
  brand_warranty_months INT DEFAULT 0,
  company_warranty_months INT DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  warranty_document VARCHAR(1000), -- S3/Local upload file key
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'voided'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warranties_tenant ON warranties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranties_project ON warranties(project_id);
CREATE INDEX IF NOT EXISTS idx_warranties_handover_item ON warranties(handover_item_id);
CREATE INDEX IF NOT EXISTS idx_warranties_status ON warranties(tenant_id, status);
-- Migration: 120_amc_module.sql
-- Description: Creates the amcs and amc_visits tables for Annual Maintenance Contract tracking.

CREATE TABLE IF NOT EXISTS amcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_number VARCHAR(100) NOT NULL,
  contract_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  covered_scope TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'expired', 'renewed', 'cancelled'
  auto_renewal_alert_days INT DEFAULT 30,
  renewal_alert_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, contract_number)
);

CREATE TABLE IF NOT EXISTS amc_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amc_id UUID NOT NULL REFERENCES amcs(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'missed', 'cancelled'
  completed_date DATE,
  technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_amcs_tenant ON amcs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_amcs_project ON amcs(project_id);
CREATE INDEX IF NOT EXISTS idx_amcs_status ON amcs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_amc_visits_tenant ON amc_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_amc_visits_amc ON amc_visits(amc_id);
CREATE INDEX IF NOT EXISTS idx_amc_visits_scheduled ON amc_visits(scheduled_date);
-- Migration: 121_vendor_warranties_and_claims.sql
-- Description: Adds vendor warranty fields and creates the warranty_claims table.

ALTER TABLE warranties
  ADD COLUMN IF NOT EXISTS product_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vendor_warranty_months INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_claim_procedure TEXT;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  warranty_id UUID REFERENCES warranties(id) ON DELETE SET NULL,
  claim_number VARCHAR(100) NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  nature_of_defect TEXT NOT NULL,
  eligibility_decision VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  eligibility_reason TEXT,
  assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
  resolution_details TEXT,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, claim_number)
);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_tenant ON warranty_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_project ON warranty_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_warranty ON warranty_claims(warranty_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON warranty_claims(tenant_id, status);
-- Migration: 122_service_tickets.sql
-- Description: Creates service_tickets and service_visits tables for post-sales support ticket tracking.

CREATE TABLE IF NOT EXISTS service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_portal_user_id UUID REFERENCES client_portal_users(id) ON DELETE SET NULL,
  ticket_number VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- e.g., 'plumbing', 'electrical', 'carpentry', 'painting', 'masonry', 'appliances', 'other'
  priority VARCHAR(50) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- 'open', 'assigned', 'scheduled', 'resolved', 'closed'
  warranty_eligibility VARCHAR(50) NOT NULL DEFAULT 'checking', -- 'eligible', 'not_eligible', 'checking', 'chargeable'
  assigned_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_details TEXT,
  resolved_at TIMESTAMP,
  client_feedback_rating INT CHECK (client_feedback_rating BETWEEN 1 AND 5),
  client_feedback_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, ticket_number)
);

CREATE TABLE IF NOT EXISTS service_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  completed_date TIMESTAMP,
  engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visit_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_tickets_tenant ON service_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_project ON service_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_engineer ON service_tickets(assigned_engineer_id);

CREATE INDEX IF NOT EXISTS idx_service_visits_tenant ON service_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_ticket ON service_visits(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_scheduled ON service_visits(scheduled_date);
-- Migration: 123_service_ticket_sla.sql
-- Description: Adds SLA support (sla_hours and due_date) to service_tickets.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- Backfill existing tickets
UPDATE service_tickets
SET sla_hours = CASE 
  WHEN priority = 'critical' THEN 4
  WHEN priority = 'high' THEN 24
  WHEN priority = 'medium' THEN 72
  WHEN priority = 'low' THEN 168
  ELSE 72
END
WHERE sla_hours IS NULL;

UPDATE service_tickets
SET due_date = created_at + (sla_hours || ' hours')::INTERVAL
WHERE due_date IS NULL;
-- Migration: 124_service_visits_scheduling.sql
-- Description: Adds client confirmation, reminder tracking, and outcome to service_visits.

ALTER TABLE service_visits
  ADD COLUMN IF NOT EXISTS client_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visit_outcome VARCHAR(255);
-- Migration: 125_csat_and_escalations.sql
-- Description: Adds client satisfaction surveys (CSAT) and ticket escalations support.

-- Add escalation_level to service_tickets
ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

-- Create csat_feedback table
CREATE TABLE IF NOT EXISTS csat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_type VARCHAR(50) NOT NULL, -- 'handover', 'service_visit'
  reference_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comments TEXT,
  pm_id UUID REFERENCES users(id) ON DELETE SET NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_ticket_escalations table
CREATE TABLE IF NOT EXISTS service_ticket_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  escalated_to_role VARCHAR(50) NOT NULL, -- 'pm', 'director'
  previous_level INTEGER NOT NULL,
  new_level INTEGER NOT NULL,
  reason VARCHAR(255),
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_csat_project ON csat_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_csat_pm ON csat_feedback(pm_id);
CREATE INDEX IF NOT EXISTS idx_csat_designer ON csat_feedback(designer_id);

CREATE INDEX IF NOT EXISTS idx_ticket_escalations_ticket ON service_ticket_escalations(ticket_id);
-- Migration: 126_project_closure_checklist.sql
-- Description: Create project_closure_checklists table to verify project closure gates.

CREATE TABLE IF NOT EXISTS project_closure_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  financial_clearance_completed BOOLEAN DEFAULT false,
  financial_clearance_notes TEXT,
  financial_clearance_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  financial_clearance_verified_at TIMESTAMP,
  
  task_completion_completed BOOLEAN DEFAULT false,
  task_completion_notes TEXT,
  task_completion_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  task_completion_verified_at TIMESTAMP,
  
  snag_closure_completed BOOLEAN DEFAULT false,
  snag_closure_notes TEXT,
  snag_closure_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  snag_closure_verified_at TIMESTAMP,
  
  document_archive_completed BOOLEAN DEFAULT false,
  document_archive_notes TEXT,
  document_archive_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  document_archive_verified_at TIMESTAMP,
  
  warranty_activation_completed BOOLEAN DEFAULT false,
  warranty_activation_notes TEXT,
  warranty_activation_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  warranty_activation_verified_at TIMESTAMP,
  
  status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_closure_tenant ON project_closure_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_closure_project ON project_closure_checklists(project_id);
-- Migration: 127_project_retrospective.sql
-- Description: Create project_retrospectives and project_retrospective_vendors tables to track lessons learned and vendor ratings.

CREATE TABLE IF NOT EXISTS project_retrospectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  what_went_well TEXT,
  what_went_wrong TEXT,
  design_feedback TEXT,
  process_changes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_retrospectives_tenant ON project_retrospectives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_project_retrospectives_project ON project_retrospectives(project_id);

CREATE TABLE IF NOT EXISTS project_retrospective_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  retrospective_id UUID NOT NULL REFERENCES project_retrospectives(id) ON DELETE CASCADE,
  project_vendor_id UUID NOT NULL REFERENCES project_vendors(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(retrospective_id, project_vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_retrospective_vendors_retrospective ON project_retrospective_vendors(retrospective_id);
CREATE INDEX IF NOT EXISTS idx_retrospective_vendors_project_vendor ON project_retrospective_vendors(project_vendor_id);
-- Migration: 128_financial_approvals.sql
-- Description: Create financial_approvals table and update status check constraints on invoices, credit_notes, and refunds.

CREATE TABLE IF NOT EXISTS financial_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'payment_update', 'discount', 'credit', 'refund')),
  target_id UUID NOT NULL, -- references invoices(id), payment_milestones(id), quotations(id), credit_notes(id), or refunds(id)
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_changes JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  threshold_limit DECIMAL(12,2),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_approvals_tenant ON financial_approvals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_approvals_status ON financial_approvals(tenant_id, status);

-- Alter check constraint on invoices, credit_notes, and refunds to allow 'pending_approval' status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.conname, t.relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname IN ('invoices', 'credit_notes', 'refunds')
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'void', 'pending_approval'));
ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_status_check CHECK (status IN ('issued', 'void', 'pending_approval'));
ALTER TABLE refunds ADD CONSTRAINT refunds_status_check CHECK (status IN ('processed', 'failed', 'void', 'pending_approval'));
-- Migration: 129_handover_internal_authorization.sql
-- Description: Adds internal authorization fields to handover checklists.

ALTER TABLE handover_checklists
  ADD COLUMN IF NOT EXISTS is_internally_authorized BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS internally_authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internally_authorized_at TIMESTAMP;
-- Migration: 130_project_pause_and_cancellation.sql
-- Description: Adds columns for project pause/hold and cancellation workflows.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS on_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS expected_resume_date DATE,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_amount_refunded DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_amount_recovered DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS settlement_notes TEXT,
  ADD COLUMN IF NOT EXISTS settlement_document_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS cancellation_client_acknowledged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancellation_client_acknowledged_at TIMESTAMP;

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
-- Migration: 131_material_discontinuation_and_room_handovers.sql
-- Description: Adds material discontinuation flag in BOQ items and creates room-level handover table.

ALTER TABLE quotation_items
  ADD COLUMN IF NOT EXISTS is_discontinued BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS project_room_handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, signed_off
  signed_off_at TIMESTAMP,
  signed_off_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_otp_verified BOOLEAN DEFAULT false,
  client_name VARCHAR(255),
  client_signature_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, room_name)
);

CREATE INDEX IF NOT EXISTS idx_project_room_handovers_project ON project_room_handovers(project_id);
-- Migration: 132_warranty_repeats_and_budget_alerts.sql
-- Description: Adds columns to support repeat warranty claim flagging and budget alert tracking.

ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS is_repeat_claim BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS repeat_claim_count INTEGER DEFAULT 0;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS alert_80_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_90_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_100_sent BOOLEAN DEFAULT FALSE;
-- Migration: 133_commercial_project_support.sql
-- Description: Adds columns and tables for commercial project compliance and multi-vendor coordination.

-- 1. Expose commercial category specific fields on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS fire_noc_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS occupancy_permit_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retention_money_percentage DECIMAL(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS ld_clause_details TEXT,
  ADD COLUMN IF NOT EXISTS stakeholder_complexity VARCHAR(50) DEFAULT 'low';

-- 2. Add scheduling and blocker tracking on project_vendors
ALTER TABLE project_vendors
  ADD COLUMN IF NOT EXISTS scheduled_start_date DATE,
  ADD COLUMN IF NOT EXISTS scheduled_finish_date DATE,
  ADD COLUMN IF NOT EXISTS blocker_description TEXT,
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(50) DEFAULT 'pending';

-- 3. Create compliance checklist table
CREATE TABLE IF NOT EXISTS project_compliance_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, approved, not_applicable
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_project_compliance_checklists_project ON project_compliance_checklists(project_id);
-- Migration: 134_customer_relationship_management.sql
-- Description: Adds tables for long-term customer relationship management and referral programs.

-- 1. Client relationship records
CREATE TABLE IF NOT EXISTS client_relationship_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  project_completed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  anniversary_date DATE NOT NULL,
  last_followup_date DATE,
  next_followup_schedule_date DATE NOT NULL,
  followup_notes TEXT,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_client_relationship_project ON client_relationship_records(project_id);

-- 2. Client referrals
CREATE TABLE IF NOT EXISTS client_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  referrer_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  referee_name VARCHAR(255) NOT NULL,
  referee_phone VARCHAR(50),
  referee_email VARCHAR(255),
  referral_status VARCHAR(50) DEFAULT 'pending', -- pending, converted, closed
  reward_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, paid, not_eligible
  reward_amount DECIMAL(12, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_referrals_referrer ON client_referrals(referrer_project_id);
-- Migration: 135_project_booking_confirmation.sql

CREATE TABLE IF NOT EXISTS project_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  advance_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50) NOT NULL, -- bank_transfer, cash, card, upi, cheque
  agreement_file_key VARCHAR(255),
  agreement_file_name VARCHAR(255),
  agreement_file_size INTEGER,
  agreement_file_mime VARCHAR(100),
  agreed_scope_summary TEXT,
  design_freeze_target_date DATE,
  project_start_date DATE,
  assigned_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_bookings_project ON project_bookings(project_id);
-- Migration: 136_project_commercial_approval.sql
-- Description: Adds project_commercial_approvals table to enforce design to execution transition check

CREATE TABLE IF NOT EXISTS project_commercial_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT unique_project_commercial_approval UNIQUE (tenant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_commercial_approvals_project ON project_commercial_approvals(project_id);
-- Migration: 137_production_site_coordination.sql
-- Description: Adds site_readiness_date to projects table for production-site coordination.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_readiness_date DATE;
-- Migration: 138_handover_readiness_by_gate.sql
-- Description: Creates handover_readiness_gates and handover_appointments tables.

CREATE TABLE IF NOT EXISTS handover_readiness_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pm_signed_off BOOLEAN DEFAULT FALSE,
  pm_signed_off_by UUID REFERENCES users(id) ON DELETE SET NULL,
  pm_signed_off_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handover_readiness_gates_project ON handover_readiness_gates(project_id);
CREATE INDEX IF NOT EXISTS idx_handover_appointments_project ON handover_appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_handover_appointments_date ON handover_appointments(appointment_date);
-- Migration: 139_customer_retention_scheduling.sql
-- Description: Creates the customer_retention_schedules table for tracking post-handover check-ins.

CREATE TABLE IF NOT EXISTS customer_retention_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL, -- '30_day', '90_day', '180_day', '365_day'
  scheduled_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'deferred', 'cancelled'
  actual_date DATE,
  feedback TEXT,
  csat_score INT CHECK (csat_score BETWEEN 1 AND 5),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_retention_project ON customer_retention_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_retention_status ON customer_retention_schedules(status);
CREATE INDEX IF NOT EXISTS idx_retention_scheduled ON customer_retention_schedules(scheduled_date);
-- Migration: 140_client_household_profile.sql
-- Description: Add client household profile fields to projects and extend project contacts with contact preferences and approval authority levels.

-- 1. Add household columns to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS spouse_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS spouse_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spouse_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS number_of_family_members INTEGER,
  ADD COLUMN IF NOT EXISTS lifestyle_preferences TEXT,
  ADD COLUMN IF NOT EXISTS preferred_communication_channel VARCHAR(50);

-- 2. Add contact preferences and approval authority level columns to project_contacts table
ALTER TABLE project_contacts
  ADD COLUMN IF NOT EXISTS contact_preference VARCHAR(50),
  ADD COLUMN IF NOT EXISTS approval_authority_level VARCHAR(50);
-- Migration: 141_project_site_logistics.sql
-- Description: Add site logistics columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lift_availability VARCHAR(50),
  ADD COLUMN IF NOT EXISTS lift_dimensions VARCHAR(100),
  ADD COLUMN IF NOT EXISTS staircase_access VARCHAR(100),
  ADD COLUMN IF NOT EXISTS working_hour_window VARCHAR(100),
  ADD COLUMN IF NOT EXISTS society_contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS parking_permission VARCHAR(100),
  ADD COLUMN IF NOT EXISTS unloading_area VARCHAR(255),
  ADD COLUMN IF NOT EXISTS noc_requirements TEXT;
-- Migration: 142_project_baseline_assessment.sql
-- Description: Create project site condition baseline assessment tables

CREATE TABLE IF NOT EXISTS project_baseline_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  overall_notes TEXT,
  video_walkthrough_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_project_baseline UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS project_baseline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES project_baseline_assessments(id) ON DELETE CASCADE,
  room_name VARCHAR(100) NOT NULL,
  area_checked VARCHAR(100) NOT NULL, -- e.g. 'walls', 'flooring', 'electrical', 'plumbing', 'civil'
  condition_status VARCHAR(50) DEFAULT 'ok', -- ok, damaged, defect, n_a
  notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb, -- array of photo URLs or objects { url, caption }
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proj_baseline_ass_proj ON project_baseline_assessments(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_proj_baseline_item_ass ON project_baseline_items(assessment_id, tenant_id);
-- Migration: 143_project_site_access.sql
-- Description: Add site access columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS key_holder_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS key_holder_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spare_key_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gate_pass_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS access_card_holder VARCHAR(255),
  ADD COLUMN IF NOT EXISTS access_time_restrictions VARCHAR(255);
-- Migration: 144_project_team_roles.sql
-- Description: Add project team user reference columns to projects table

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lead_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS junior_designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qc_engineer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crm_executive_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS procurement_officer_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- Migration: 145_structured_design_brief.sql
-- Description: Add columns for structured brief to lead_preferences and project_design_requirements tables.

-- 1. Add fields to project_design_requirements table
ALTER TABLE project_design_requirements
  ADD COLUMN IF NOT EXISTS family_size INTEGER,
  ADD COLUMN IF NOT EXISTS usage_patterns TEXT,
  ADD COLUMN IF NOT EXISTS storage_priorities TEXT,
  ADD COLUMN IF NOT EXISTS brand_flexibility VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand_remarks TEXT,
  ADD COLUMN IF NOT EXISTS existing_furniture TEXT,
  ADD COLUMN IF NOT EXISTS budget_category_allocation JSONB DEFAULT '{}'::jsonb;

-- 2. Add fields to lead_preferences table
ALTER TABLE lead_preferences
  ADD COLUMN IF NOT EXISTS family_size INTEGER,
  ADD COLUMN IF NOT EXISTS usage_patterns TEXT,
  ADD COLUMN IF NOT EXISTS storage_priorities TEXT,
  ADD COLUMN IF NOT EXISTS brand_flexibility VARCHAR(100),
  ADD COLUMN IF NOT EXISTS brand_remarks TEXT,
  ADD COLUMN IF NOT EXISTS existing_furniture TEXT,
  ADD COLUMN IF NOT EXISTS budget_category_allocation JSONB DEFAULT '{}'::jsonb;
-- Migration: 146_design_stage_workflow.sql
-- Description: Add columns for design stages and history to projects.

-- 1. Add design_stage column to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS design_stage VARCHAR(50) DEFAULT 'Requirement Gathering';

-- 2. Create project_design_stage_history table
CREATE TABLE IF NOT EXISTS project_design_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_confirmed BOOLEAN DEFAULT FALSE,
  client_confirmed_at TIMESTAMP,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_design_stage_history_project ON project_design_stage_history(project_id);
-- Migration: 147_material_sample_approvals.sql
-- Description: Adds sample category, presentation date, client decision, signature, and BOQ item link to project_material_palettes.

ALTER TABLE project_material_palettes
  ADD COLUMN IF NOT EXISTS sample_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS date_presented DATE,
  ADD COLUMN IF NOT EXISTS client_decision VARCHAR(50) DEFAULT 'deferred', -- approved, rejected, deferred
  ADD COLUMN IF NOT EXISTS approved_by_signature VARCHAR(255),
  ADD COLUMN IF NOT EXISTS boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_material_palettes_boq ON project_material_palettes(boq_item_id);
-- Migration: 148_layout_tracking_and_mep_checklist.sql
-- Description: Add layout type classification, approval workflows, and MEP checklists

-- 1. Add layout tracking columns to drawing_register
ALTER TABLE drawing_register
  ADD COLUMN IF NOT EXISTS layout_type VARCHAR(50) CHECK (layout_type IN ('electrical', 'plumbing', 'civil', 'false_ceiling', 'furniture', 'flooring')),
  ADD COLUMN IF NOT EXISTS client_status VARCHAR(50) DEFAULT 'pending' CHECK (client_status IN ('pending', 'approved', 'revision_requested')),
  ADD COLUMN IF NOT EXISTS client_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_notes TEXT,
  ADD COLUMN IF NOT EXISTS contractor_status VARCHAR(50) DEFAULT 'pending' CHECK (contractor_status IN ('pending', 'approved', 'revision_requested')),
  ADD COLUMN IF NOT EXISTS contractor_approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contractor_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS contractor_notes TEXT;

-- 2. Create project_mep_checklists table
CREATE TABLE IF NOT EXISTS project_mep_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'approved', 'not_applicable')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_project_mep_checklists_project ON project_mep_checklists(project_id);
-- Migration: 149_add_stage_revision_limits.sql
-- Description: Adds configuration for allowed revision limits and counts per design stage.

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS stage_revision_limits JSONB DEFAULT '{"Requirement Gathering": 3, "Concept Presentation": 3, "Concept Approval": 3, "Detailed Design": 3, "Client Review": 3, "Revision Rounds": 3, "Design Freeze": 3}'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_revision_counts JSONB DEFAULT '{"Requirement Gathering": 0, "Concept Presentation": 0, "Concept Approval": 0, "Detailed Design": 0, "Client Review": 0, "Revision Rounds": 0, "Design Freeze": 0}'::jsonb;

-- Populate existing rows where JSON is empty or null
UPDATE projects
SET 
  stage_revision_limits = jsonb_build_object(
    'Requirement Gathering', COALESCE(allowed_design_revisions, 3),
    'Concept Presentation', COALESCE(allowed_design_revisions, 3),
    'Concept Approval', COALESCE(allowed_design_revisions, 3),
    'Detailed Design', COALESCE(allowed_design_revisions, 3),
    'Client Review', COALESCE(allowed_design_revisions, 3),
    'Revision Rounds', COALESCE(allowed_design_revisions, 3),
    'Design Freeze', COALESCE(allowed_design_revisions, 3)
  ),
  stage_revision_counts = '{"Requirement Gathering": 0, "Concept Presentation": 0, "Concept Approval": 0, "Detailed Design": 0, "Client Review": 0, "Revision Rounds": 0, "Design Freeze": 0}'::jsonb
WHERE stage_revision_limits IS NULL OR stage_revision_limits = '{}'::jsonb;
-- Migration: 150_gst_compliance_fields.sql
-- Description: Adds GST compliance fields for Works Contract / Composite Supply and HSN/SAC codes.

-- 1. Add fields to quotations table
ALTER TABLE quotations
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply')),
ADD COLUMN IF NOT EXISTS works_contract_rate DECIMAL(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS works_contract_hsn VARCHAR(50) DEFAULT '9954';

-- 2. Add fields to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply'));

-- 3. Add fields to credit_notes table
ALTER TABLE credit_notes
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_treatment VARCHAR(50) DEFAULT 'itemized' CHECK (tax_treatment IN ('itemized', 'works_contract', 'composite_supply'));
-- Migration: 151_labor_cost_estimation.sql
-- Description: Adds labor trade and estimation fields to quotations and quotation items

-- 1. Add labor subtotal tracking columns to quotations
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS material_subtotal NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_subtotal NUMERIC(15,2) DEFAULT 0;

-- 2. Add trade and rate tracking columns to quotation_items
ALTER TABLE quotation_items 
ADD COLUMN IF NOT EXISTS labor_trade VARCHAR(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS labor_rate_type VARCHAR(50) DEFAULT 'rate_per_unit',
ADD COLUMN IF NOT EXISTS labor_unit_rate NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_markup_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS labor_total_price NUMERIC(15,2) DEFAULT 0;

-- 3. Backfill existing quotations' material_subtotal with their current subtotal
UPDATE quotations 
SET material_subtotal = COALESCE(subtotal, 0)
WHERE material_subtotal = 0 AND subtotal > 0;
-- Migration: 152_purchase_requests.sql
-- Description: Adds tables for Purchase Request (PR) system and links them to projects, users, BOQ items, and Purchase Orders.

CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  pr_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'cancelled')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  required_by_date TIMESTAMP NOT NULL,
  delivery_location VARCHAR(100) DEFAULT 'site' CHECK (delivery_location IN ('warehouse', 'site')),
  notes TEXT,
  pm_feedback TEXT,
  total_amount DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_purchase_request_number UNIQUE (tenant_id, pr_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_project ON purchase_requests(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);

CREATE TABLE IF NOT EXISTS purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(50),
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  brand VARCHAR(100),
  material_specifications TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON purchase_request_items(purchase_request_id, tenant_id);

-- Link purchase requests to purchase orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_pr ON purchase_orders(purchase_request_id);

ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS pr_item_id UUID REFERENCES purchase_request_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_items_pr_item ON purchase_order_items(pr_item_id);
-- Migration: 153_purchase_orders_delivery_address.sql
-- Description: Adds delivery_address column to purchase_orders table.

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS delivery_address TEXT DEFAULT NULL;
-- Migration: 154_warehouse_inventory.sql
-- Description: Creates tables for Warehouses, Inventory items, Quarantined inventory, and Inventory Transactions logs.

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_warehouse_name UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) DEFAULT 0.00,
  unit VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Project Tagging (null = general stock)
  bin_location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_inventory_item ON inventory_items (
  tenant_id, 
  warehouse_id, 
  item_name, 
  (COALESCE(brand, '')), 
  (COALESCE(material_specifications, '')), 
  (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

CREATE TABLE IF NOT EXISTS quarantined_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) DEFAULT 0.00,
  unit VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- Tagged project
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_quarantined_item ON quarantined_items (
  tenant_id, 
  warehouse_id, 
  item_name, 
  (COALESCE(brand, '')), 
  (COALESCE(material_specifications, '')), 
  (COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
  (COALESCE(reason, ''))
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('receipt', 'dispatch_to_site', 'return_from_site', 'quarantine_damaged', 'release_from_quarantine', 'write_off')),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  material_specifications TEXT,
  brand VARCHAR(255),
  quantity DECIMAL(12, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Migration: 155_handover_brand_registration.sql
-- Description: Adds column for brand registration card tracking to handover items

ALTER TABLE handover_items
  ADD COLUMN IF NOT EXISTS has_brand_registration_card BOOLEAN DEFAULT false;
-- Migration: 155_vendor_lead_times.sql
-- Description: Adds tables for vendor lead times configuration per material category and updates PR/PO items schema.

CREATE TABLE IF NOT EXISTS vendor_lead_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE CASCADE,
  material_category VARCHAR(100) NOT NULL,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to handle null vendor_id (default lead time for a category)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_vendor_lead_times ON vendor_lead_times (
  tenant_id, 
  (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)), 
  material_category
);

-- Alter purchase_request_items table
ALTER TABLE purchase_request_items
ADD COLUMN IF NOT EXISTS material_category VARCHAR(100) DEFAULT 'general';

-- Alter purchase_order_items table
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS material_category VARCHAR(100) DEFAULT 'general';

-- Insert default configurations for the standard demo tenant
-- Fetch demo tenant ID dynamically in script or default to inserting when setup runs
DO $$
DECLARE
  demo_tenant_id UUID;
BEGIN
  SELECT id INTO demo_tenant_id FROM tenants WHERE slug = 'demo';
  IF demo_tenant_id IS NOT NULL THEN
    INSERT INTO vendor_lead_times (tenant_id, vendor_id, material_category, lead_time_days)
    VALUES
      (demo_tenant_id, NULL, 'plywood', 7),
      (demo_tenant_id, NULL, 'hardware', 3),
      (demo_tenant_id, NULL, 'laminate', 5),
      (demo_tenant_id, NULL, 'paint', 3),
      (demo_tenant_id, NULL, 'electrical', 4),
      (demo_tenant_id, NULL, 'plumbing', 4),
      (demo_tenant_id, NULL, 'modular', 15),
      (demo_tenant_id, NULL, 'general', 5)
    ON CONFLICT (tenant_id, (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)), material_category)
    DO UPDATE SET lead_time_days = EXCLUDED.lead_time_days;
  END IF;
END $$;
-- Migration: 156_factory_production_stages_and_cutting_lists.sql
-- Description: Adds columns for factory production stages (cutting, edge banding, drilling, assembly) and creates tables for cutting lists and CNC request tracking.

-- 1. Alter production_order_items to add production stage tracking columns
ALTER TABLE production_order_items DROP COLUMN IF EXISTS cutting_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS edge_banding_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS drilling_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS assembly_status CASCADE;
ALTER TABLE production_order_items DROP COLUMN IF EXISTS cnc_status CASCADE;

ALTER TABLE production_order_items 
ADD COLUMN cutting_status VARCHAR(50) DEFAULT 'pending' CHECK (cutting_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN edge_banding_status VARCHAR(50) DEFAULT 'pending' CHECK (edge_banding_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN drilling_status VARCHAR(50) DEFAULT 'pending' CHECK (drilling_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN assembly_status VARCHAR(50) DEFAULT 'pending' CHECK (assembly_status IN ('pending', 'in_progress', 'completed', 'na')),
ADD COLUMN cnc_status VARCHAR(50) DEFAULT 'not_required' CHECK (cnc_status IN ('not_required', 'pending_request', 'generated', 'completed'));

-- 2. Create Cutting Lists Table
CREATE TABLE IF NOT EXISTS production_cutting_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_item_id UUID NOT NULL REFERENCES production_order_items(id) ON DELETE CASCADE,
  panel_name VARCHAR(255) NOT NULL,
  length_mm DECIMAL(10, 2) NOT NULL,
  width_mm DECIMAL(10, 2) NOT NULL,
  thickness_mm DECIMAL(10, 2) NOT NULL,
  material VARCHAR(255) NOT NULL,
  edge_banding VARCHAR(255) NOT NULL DEFAULT 'none',
  quantity INTEGER NOT NULL DEFAULT 1,
  cnc_program_name VARCHAR(255),
  cnc_status VARCHAR(50) DEFAULT 'not_required' CHECK (cnc_status IN ('not_required', 'requested', 'completed')),
  cnc_notes TEXT,
  assembly_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cutting_lists_item ON production_cutting_lists(production_order_item_id, tenant_id);

-- 3. Create CNC Requests Table
CREATE TABLE IF NOT EXISTS production_cnc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  request_number VARCHAR(100) NOT NULL,
  designer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  program_file_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_production_cnc_request_number UNIQUE (tenant_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_cnc_requests_project ON production_cnc_requests(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_cnc_requests_order ON production_cnc_requests(production_order_id, tenant_id);
CREATE TABLE IF NOT EXISTS project_weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL,
    report_date DATE NOT NULL,
    tasks_completed_json JSONB,
    milestones_reached_json JSONB,
    photos_json JSONB,
    next_week_plan_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
-- Migration: 157_client_document_approvals.sql
-- Description: Adds formal approval tracking to documents for the client portal.

ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS client_approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, revision_requested
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_revision_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_revision_note TEXT;

-- For existing documents that were acknowledged, let's mark them as approved if needed, 
-- or leave them pending if we want explicit approval. We'll just leave them, or map it.
-- Let's map acknowledged documents to 'approved' to maintain state logic.
UPDATE documents 
SET client_approval_status = 'approved', client_approved_at = client_acknowledged_at
WHERE client_acknowledged_at IS NOT NULL AND client_approval_status = 'pending';
-- Migration: 157_production_qc_checklist_column.sql
-- Description: Adds a checklist column to production_qc_inspections to support structured item-wise acceptance criteria checklist.

ALTER TABLE production_qc_inspections
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';
-- Migration: 158_production_dispatch_manifest_and_time.sql
-- Description: Adds a manifest column to production_dispatches to support detailed material shipping list.

ALTER TABLE production_dispatches
ADD COLUMN IF NOT EXISTS manifest JSONB DEFAULT '[]';
-- Migration: 158_project_site_visits.sql
-- Description: Enhances site_visits to support projects, agendas, and formal outcomes.

ALTER TABLE site_visits 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agenda TEXT,
  ADD COLUMN IF NOT EXISTS next_steps TEXT,
  ADD COLUMN IF NOT EXISTS client_acknowledged_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_acknowledged_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_site_visits_project ON site_visits(project_id);

CREATE TABLE IF NOT EXISTS site_visit_linked_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_visit_id UUID NOT NULL REFERENCES site_visits(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL, -- 'task', 'snag'
  item_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sv_linked_items_visit ON site_visit_linked_items(site_visit_id);
-- Migration: 159_configurable_trade_activities.sql
-- Description: Adds tenant-configurable trade templates, activity dependencies, and photo completion evidence.

-- 1. Alter trade_activity_templates to add tenant support
ALTER TABLE trade_activity_templates
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trade_act_tpl_tenant ON trade_activity_templates(tenant_id);

-- 2. Create work activity dependencies table
CREATE TABLE IF NOT EXISTS work_activity_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  depends_on_activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  dependency_type VARCHAR(50) NOT NULL DEFAULT 'finish-to-start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_work_activity_dependency UNIQUE (activity_id, depends_on_activity_id),
  CONSTRAINT chk_activity_self_dependency CHECK (activity_id <> depends_on_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_work_act_dep_act ON work_activity_dependencies(activity_id);
CREATE INDEX IF NOT EXISTS idx_work_act_dep_depends ON work_activity_dependencies(depends_on_activity_id);
CREATE INDEX IF NOT EXISTS idx_work_act_dep_proj ON work_activity_dependencies(project_id);

-- 3. Create work activity photos completion evidence table
CREATE TABLE IF NOT EXISTS work_activity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES project_work_activities(id) ON DELETE CASCADE,
  file_url VARCHAR(512) NOT NULL,
  caption VARCHAR(255),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_act_photos_act ON work_activity_photos(activity_id);
-- Migration: 160_trade_dependency_templates.sql
-- Description: Adds trade_dependency_templates table for pre-configured standard trade sequences.

CREATE TABLE IF NOT EXISTS trade_dependency_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  trade VARCHAR(100) NOT NULL,
  depends_on_trade VARCHAR(100) NOT NULL,
  dependency_type VARCHAR(50) DEFAULT 'finish-to-start',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_trade_dependency_template UNIQUE NULLS NOT DISTINCT (tenant_id, trade, depends_on_trade)
);

CREATE INDEX IF NOT EXISTS idx_trade_dep_tpl_tenant ON trade_dependency_templates(tenant_id);

-- Insert standard industry sequences as defaults for all tenants (tenant_id IS NULL)
INSERT INTO trade_dependency_templates (trade, depends_on_trade) VALUES
  ('plumbing', 'civil'),
  ('electrical', 'civil'),
  ('false_ceiling', 'civil'),
  ('false_ceiling', 'electrical'),
  ('flooring', 'civil'),
  ('flooring', 'plumbing'),
  ('flooring', 'electrical'),
  ('painting', 'civil'),
  ('painting', 'false_ceiling'),
  ('carpentry', 'flooring'),
  ('glass', 'flooring'),
  ('soft_furnishing', 'carpentry'),
  ('soft_furnishing', 'painting')
ON CONFLICT DO NOTHING;
-- Migration: 161_site_issue_escalation.sql
-- Description: Adds blocked_at and escalation_level columns to tasks for the Site Issue Escalation Workflow.

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

-- Set escalation_level to 0 for any tasks where it might be null
UPDATE tasks SET escalation_level = 0 WHERE escalation_level IS NULL;

-- If a task is currently blocked, set blocked_at to updated_at as a fallback
UPDATE tasks SET blocked_at = updated_at WHERE status = 'blocked' AND blocked_at IS NULL;
-- Migration: 162_daily_site_report_enhancements.sql
-- Description: Enhances daily site reports to include tomorrows_plan and supervisor_signature.

ALTER TABLE daily_site_reports
ADD COLUMN IF NOT EXISTS tomorrows_plan TEXT,
ADD COLUMN supervisor_signature TEXT;
-- Migration: 163_labour_attendance.sql
-- Description: Creates labour_attendance table for tracking site workers and contractor/vendor teams.

CREATE TABLE IF NOT EXISTS labour_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  worker_name VARCHAR(255) NOT NULL,
  trade VARCHAR(100) NOT NULL,
  vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  contractor_name VARCHAR(255),
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_assigned TEXT,
  attendance_method VARCHAR(50) DEFAULT 'manual' CHECK (attendance_method IN ('manual', 'qr', 'otp')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labour_attendance_project ON labour_attendance(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_labour_attendance_vendor ON labour_attendance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_labour_attendance_date ON labour_attendance(check_in_time);
-- Migration: 164_site_expenses.sql
-- Description: Creates site_expenses table for tracking petty cash and daily site spending.

CREATE TABLE IF NOT EXISTS site_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('material', 'labour_advance', 'transport', 'miscellaneous')),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  description TEXT NOT NULL,
  receipt_photo_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE,
  is_reimbursed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_expenses_project ON site_expenses(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_expenses_status ON site_expenses(tenant_id, status);
-- Migration: 165_site_material_usages.sql
-- Description: Creates site_material_usages table to log daily material consumption at site.

CREATE TABLE IF NOT EXISTS site_material_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  boq_item_id UUID REFERENCES quotation_items(id) ON DELETE SET NULL,
  activity_name VARCHAR(255) NOT NULL,
  material_name VARCHAR(255),
  quantity_used DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  date_used DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_mat_usages_project ON site_material_usages(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_site_mat_usages_po_item ON site_material_usages(po_item_id);
CREATE TABLE user_leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'active', 'completed', 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE project_coverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  leave_id UUID REFERENCES user_leaves(id),
  project_id UUID REFERENCES projects(id),
  covering_user_id UUID REFERENCES users(id),
  handover_notes TEXT,
  client_notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS vendor_capacity_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  estimated_team_strength INT DEFAULT 0,
  max_concurrent_projects INT DEFAULT 5,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, overloaded
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, vendor_name)
);
-- Migration: 168_stage_qc_checklists.sql
-- Description: Configurable QC checklists per execution stage.

CREATE TABLE IF NOT EXISTS qc_stage_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL, -- e.g. 'Civil ready check'
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qc_checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES qc_stage_templates(id) ON DELETE CASCADE,
  item_text VARCHAR(255) NOT NULL,
  is_photo_mandatory BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Project instances of QC Checklists
CREATE TABLE IF NOT EXISTS project_qc_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL, 
  stage_name VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
  qc_engineer_id UUID REFERENCES users(id),
  signed_off_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_qc_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES project_qc_stages(id) ON DELETE CASCADE,
  item_text VARCHAR(255) NOT NULL,
  is_photo_mandatory BOOLEAN DEFAULT true,
  is_passed BOOLEAN,
  photo_url VARCHAR(255),
  notes TEXT,
  checked_by UUID REFERENCES users(id),
  checked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_stage_proj_phase ON project_qc_stages(project_id, phase_id);

-- Seed default templates for demo tenant
DO $$
DECLARE
  v_tenant_id UUID;
  v_template_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'demo' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    
    -- 1. Civil ready check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Civil ready check', 'Pre-requisite for starting electrical rough-in', 10) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Walls are plastered and cured properly', true, 1),
    (v_template_id, 'Floor hacking is complete and debris removed', true, 2),
    (v_template_id, 'Brickwork partitions are according to plan', true, 3);

    -- 2. Electrical rough-in check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Electrical rough-in check', 'Check conduits and boxes before plastering/closing', 20) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Conduits laid as per electrical layout drawing', true, 1),
    (v_template_id, 'Metal backboxes fixed at correct heights', true, 2),
    (v_template_id, 'No damage to structural columns during chasing', true, 3);

    -- 3. False ceiling check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'False ceiling check', 'Check framing and boarding before painting', 30) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Level check of the framing grids', true, 1),
    (v_template_id, 'Gypsum boards screwed properly without sagging', true, 2),
    (v_template_id, 'Light cutouts made accurately', true, 3);

    -- 4. Painting check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Painting check', 'Check primer and first coat finishes', 40) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Wall putty is smooth and sanded properly', true, 1),
    (v_template_id, 'Primer coat applied evenly without patches', true, 2),
    (v_template_id, 'First coat of emulsion is consistent', true, 3);

    -- 5. Modular installation check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Modular installation check', 'Check alignment and fixing of modular units', 50) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Carcass units are leveled and plumb', true, 1),
    (v_template_id, 'All wall units are securely anchored', true, 2),
    (v_template_id, 'Shutters are aligned with uniform gaps', true, 3);

    -- 6. Hardware installation check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Hardware installation check', 'Check smooth operation of accessories', 60) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Hinges soft-close is working smoothly', true, 1),
    (v_template_id, 'Drawers and channels operate without friction', true, 2),
    (v_template_id, 'Handles and knobs fixed straight and tight', true, 3);

    -- 7. Final finishing check
    INSERT INTO qc_stage_templates (tenant_id, stage_name, description, sort_order) 
    VALUES (v_tenant_id, 'Final finishing check', 'Pre-handover comprehensive check', 70) RETURNING id INTO v_template_id;
    INSERT INTO qc_checklist_template_items (template_id, item_text, is_photo_mandatory, sort_order) VALUES
    (v_template_id, 'Final coat of paint has no defects or scratches', true, 1),
    (v_template_id, 'Site is thoroughly cleaned', true, 2),
    (v_template_id, 'All electrical and plumbing fixtures tested and working', true, 3);

  END IF;
END $$;
-- Migration: 169_snag_root_cause.sql
-- Description: Adds root cause category and vendor tracking to snags for defect root cause analysis.

ALTER TABLE snags 
  ADD COLUMN IF NOT EXISTS root_cause_category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES project_vendors(id);

CREATE INDEX IF NOT EXISTS idx_snags_root_cause ON snags(tenant_id, root_cause_category);
CREATE INDEX IF NOT EXISTS idx_snags_vendor ON snags(tenant_id, vendor_id);
CREATE TABLE external_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspector_name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  inspection_date DATE NOT NULL,
  findings TEXT,
  severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ext_inspections_project ON external_inspections(project_id);
CREATE INDEX idx_ext_inspections_status ON external_inspections(status);
-- Migration: 171_project_installation_warranty.sql
-- Description: Adds project-level installation warranty tracking to the projects table.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS installation_warranty_start_date DATE,
  ADD COLUMN IF NOT EXISTS installation_warranty_end_date DATE,
  ADD COLUMN IF NOT EXISTS installation_warranty_scope TEXT,
  ADD COLUMN IF NOT EXISTS installation_warranty_status VARCHAR(50) DEFAULT 'active';

-- Add index on status for faster querying of active/expired warranties across projects
CREATE INDEX IF NOT EXISTS idx_projects_installation_warranty_status ON projects(tenant_id, installation_warranty_status);
-- Migration: 172_amc_enhancements.sql
-- Description: Adds detailed tracking fields for AMCs and links them to warranty claims

ALTER TABLE amcs
  ADD COLUMN IF NOT EXISTS visit_frequency VARCHAR(50) DEFAULT 'quarterly',
  ADD COLUMN IF NOT EXISTS covered_products JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS exclusions TEXT,
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  ADD COLUMN IF NOT EXISTS payment_schedule TEXT,
  ALTER COLUMN auto_renewal_alert_days SET DEFAULT 90;

ALTER TABLE warranty_claims
  ADD COLUMN IF NOT EXISTS amc_id UUID REFERENCES amcs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_warranty_claims_amc ON warranty_claims(amc_id);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS warranty_exclusions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS warranty_terms_acknowledged_by VARCHAR(255);
-- Migration: 174_service_ticket_parts.sql
-- Description: Creates service_ticket_parts table to track parts used during service ticket resolution.

CREATE TABLE IF NOT EXISTS service_ticket_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES service_visits(id) ON DELETE SET NULL,
  part_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  cost DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_tenant ON service_ticket_parts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_ticket ON service_ticket_parts(ticket_id);
CREATE INDEX IF NOT EXISTS idx_service_ticket_parts_visit ON service_ticket_parts(visit_id);
-- Migration: 175_service_ticket_sla_tiers.sql
-- Description: Adds distinct First Response and Resolution SLAs for service tickets.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS first_response_sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS first_response_due_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resolution_due_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMP;

-- Backfill existing data to map old sla_hours to resolution_sla_hours
UPDATE service_tickets
SET 
  resolution_sla_hours = COALESCE(sla_hours, CASE 
    WHEN priority = 'critical' THEN 24
    WHEN priority = 'high' THEN 72
    WHEN priority = 'medium' THEN 168
    WHEN priority = 'low' THEN 168
    ELSE 168
  END),
  resolution_due_date = COALESCE(due_date, created_at + ((COALESCE(sla_hours, 168)) || ' hours')::INTERVAL),
  first_response_sla_hours = CASE
    WHEN priority = 'critical' THEN 4
    WHEN priority = 'high' THEN 24
    WHEN priority = 'medium' THEN 72
    WHEN priority = 'low' THEN 72
    ELSE 72
  END
WHERE resolution_sla_hours IS NULL;

UPDATE service_tickets
SET 
  first_response_due_date = created_at + (first_response_sla_hours || ' hours')::INTERVAL
WHERE first_response_due_date IS NULL;

-- Automatically set first_responded_at for tickets that are no longer 'open'
UPDATE service_tickets
SET first_responded_at = updated_at
WHERE status != 'open' AND first_responded_at IS NULL;
-- Migration: 176_service_ticket_repeat_complaints.sql
-- Description: Adds affected_item and is_repeat_complaint fields to service_tickets for repeat complaint detection.

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS affected_item VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_repeat_complaint BOOLEAN DEFAULT false;
-- Migration: 177_service_ticket_chargeable_estimates.sql
-- Description: Adds chargeable_estimate, chargeable_estimate_status, and chargeable_estimate_approved_at to service_tickets

ALTER TABLE service_tickets 
  ADD COLUMN IF NOT EXISTS chargeable_estimate NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS chargeable_estimate_status VARCHAR(50), -- 'pending_approval', 'approved', 'rejected'
  ADD COLUMN IF NOT EXISTS chargeable_estimate_approved_at TIMESTAMP;
-- Migration: 178_project_profitability.sql
-- Description: Adds views for project cost ledger and profitability tracking.

-- 1. Create the project_cost_ledger_view to aggregate all costs
CREATE OR REPLACE VIEW project_cost_ledger_view AS
-- 1. Material Cost from Purchase Orders (excluding drafts/cancelled)
SELECT 
    po.id AS source_id,
    po.tenant_id,
    po.project_id,
    'material' AS cost_category,
    'Purchase Order' AS source_type,
    po.po_number AS reference,
    po.total_amount AS amount,
    po.created_at AS incurred_date
FROM purchase_orders po
WHERE po.status NOT IN ('draft', 'cancelled')

UNION ALL

-- 2. Vendor Cost from Vendor Payment Milestones
SELECT 
    vpm.id AS source_id,
    vpm.tenant_id,
    vpm.project_id,
    'vendor' AS cost_category,
    'Vendor Payment' AS source_type,
    vpm.name AS reference,
    vpm.amount AS amount,
    COALESCE(vpm.paid_at, vpm.created_at) AS incurred_date
FROM vendor_payment_milestones vpm

UNION ALL

-- 3. Site Expenses (mapped to categories)
SELECT 
    se.id AS source_id,
    se.tenant_id,
    se.project_id,
    CASE 
        WHEN se.expense_type = 'material' THEN 'material'
        WHEN se.expense_type = 'labour_advance' THEN 'labour'
        ELSE 'overhead'
    END AS cost_category,
    'Site Expense' AS source_type,
    se.description AS reference,
    se.amount AS amount,
    se.submitted_at AS incurred_date
FROM site_expenses se
WHERE se.status = 'approved'

UNION ALL

-- 4. Direct Project Expenses (Overhead, Labour, etc.)
SELECT 
    pe.id AS source_id,
    pe.tenant_id,
    pe.project_id,
    pe.category AS cost_category,
    'Direct Expense' AS source_type,
    pe.description AS reference,
    pe.amount AS amount,
    pe.incurred_date AS incurred_date
FROM project_expenses pe;

-- 2. Create the project_profitability_view
CREATE OR REPLACE VIEW project_profitability_view AS
WITH project_costs AS (
    SELECT 
        project_id,
        tenant_id,
        SUM(CASE WHEN cost_category = 'material' THEN amount ELSE 0 END) AS total_material_cost,
        SUM(CASE WHEN cost_category = 'labour' THEN amount ELSE 0 END) AS total_labour_cost,
        SUM(CASE WHEN cost_category = 'vendor' THEN amount ELSE 0 END) AS total_vendor_cost,
        SUM(CASE WHEN cost_category = 'overhead' THEN amount ELSE 0 END) AS total_overhead_cost,
        SUM(amount) AS total_cost
    FROM project_cost_ledger_view
    GROUP BY project_id, tenant_id
)
SELECT 
    p.id AS project_id,
    p.tenant_id,
    p.name AS project_name,
    COALESCE(p.contract_value, 0) AS revenue,
    COALESCE(pc.total_material_cost, 0) AS total_material_cost,
    COALESCE(pc.total_labour_cost, 0) AS total_labour_cost,
    COALESCE(pc.total_vendor_cost, 0) AS total_vendor_cost,
    COALESCE(pc.total_overhead_cost, 0) AS total_overhead_cost,
    COALESCE(pc.total_cost, 0) AS total_cost,
    (COALESCE(p.contract_value, 0) - COALESCE(pc.total_cost, 0)) AS gross_margin,
    CASE 
        WHEN COALESCE(p.contract_value, 0) > 0 
        THEN ROUND(((COALESCE(p.contract_value, 0) - COALESCE(pc.total_cost, 0)) / p.contract_value * 100), 2)
        ELSE 0 
    END AS gross_margin_percentage
FROM projects p
LEFT JOIN project_costs pc ON p.id = pc.project_id AND p.tenant_id = pc.tenant_id;
-- Migration: 179_budget_categories_expansion.sql
-- Description: Expands budget categories to include civil, electrical, plumbing, carpentry as per audit requirements.

ALTER TABLE project_budgets DROP CONSTRAINT IF EXISTS project_budgets_category_check;
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_category_check;

ALTER TABLE project_budgets ADD CONSTRAINT project_budgets_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry'));
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_category_check CHECK (category IN ('labour', 'material', 'vendor', 'overhead', 'civil', 'electrical', 'plumbing', 'carpentry'));
CREATE TABLE IF NOT EXISTS project_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  schedule_score VARCHAR(50),
  financial_score VARCHAR(50),
  qc_score VARCHAR(50),
  client_score VARCHAR(50),
  overall_health VARCHAR(50),
  raw_data_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_health_project_id ON project_health_reports (project_id);
CREATE INDEX idx_project_health_tenant_id ON project_health_reports (tenant_id);
CREATE INDEX idx_project_health_report_date ON project_health_reports (report_date);
-- Migration: 181_payment_milestone_reminders.sql
-- Description: Add reminder stage tracking for payment milestones automation

ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS reminder_stage INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;
-- Migration: 182_department_roles_and_permissions
-- Description: Introduces department-wise default roles with strict permission bundles

DO $$ 
DECLARE
  t RECORD;
  superadmin_perms TEXT := '["*"]';
  
  -- Default permissions for new roles
  designer_perms TEXT := '["projects:read", "design:read", "design:manage", "design:approve"]';
  procurement_perms TEXT := '["projects:read", "procurement:read", "procurement:manage", "procurement:approve"]';
  finance_perms TEXT := '["projects:read", "finance:read", "finance:invoices", "finance:payments", "finance:discounts", "finance:manage"]';
  qc_perms TEXT := '["projects:read", "qc:read", "qc:manage", "qc:approve"]';
  handover_perms TEXT := '["projects:read", "handover:read", "handover:authorize"]';
  warranty_perms TEXT := '["projects:read", "warranty:read", "warranty:manage"]';
  support_perms TEXT := '["projects:read", "support:read", "support:manage"]';

BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    -- 1. Ensure Superadmin has wildcard
    UPDATE roles 
    SET permissions = superadmin_perms
    WHERE tenant_id = t.id AND name = 'superadmin';

    -- 2. Insert Designer
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Designer') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Designer', designer_perms);
    END IF;

    -- 3. Insert Procurement Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Procurement Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Procurement Manager', procurement_perms);
    END IF;

    -- 4. Insert Finance Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Finance Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Finance Manager', finance_perms);
    END IF;

    -- 5. Insert QC Inspector
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'QC Inspector') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'QC Inspector', qc_perms);
    END IF;

    -- 6. Insert Handover Specialist
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Handover Specialist') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Handover Specialist', handover_perms);
    END IF;

    -- 7. Insert Warranty Manager
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Warranty Manager') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Warranty Manager', warranty_perms);
    END IF;

    -- 8. Insert Customer Support
    IF NOT EXISTS (SELECT 1 FROM roles WHERE tenant_id = t.id AND name = 'Customer Support Rep') THEN
      INSERT INTO roles (tenant_id, name, permissions) VALUES (t.id, 'Customer Support Rep', support_perms);
    END IF;

  END LOOP;
END $$;
-- Migration: 183_financial_approval_tiers.sql
-- Description: Add required_authority_level to financial approvals and allow change_order transaction_type

-- Add required_authority_level column
ALTER TABLE financial_approvals 
ADD COLUMN IF NOT EXISTS required_authority_level VARCHAR(50) DEFAULT 'level_1';

-- Update check constraints for transaction_type
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.conname, t.relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'financial_approvals'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%transaction_type%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE financial_approvals 
ADD CONSTRAINT financial_approvals_transaction_type_check 
CHECK (transaction_type IN ('invoice', 'payment', 'payment_update', 'discount', 'credit', 'refund', 'change_order'));

-- Allow change_orders to have a pending_approval status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.conname, t.relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'change_orders'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE change_orders 
ADD CONSTRAINT change_orders_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'executed', 'cancelled'));

-- Migration: 184_vendor_default_handling.sql
-- Description: Add fields to project_vendors to track vendor defaults and financial recovery

ALTER TABLE project_vendors
  ADD COLUMN IF NOT EXISTS default_date DATE,
  ADD COLUMN IF NOT EXISTS work_completed_assessment TEXT,
  ADD COLUMN IF NOT EXISTS outstanding_scope TEXT,
  ADD COLUMN IF NOT EXISTS replacement_vendor_id UUID REFERENCES project_vendors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_recovery_amount DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS financial_recovery_status VARCHAR(50) DEFAULT 'pending';

-- Optional: Create an index for quick lookup of defaulted vendors
CREATE INDEX IF NOT EXISTS idx_project_vendors_default_date ON project_vendors(default_date) WHERE default_date IS NOT NULL;

-- Migration 185_payment_default_escalation.sql
-- Description: Adds payment_escalations table to track structured responses to payment defaults.

CREATE TABLE IF NOT EXISTS payment_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_milestone_id UUID NOT NULL REFERENCES payment_milestones(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  escalation_level VARCHAR(50) NOT NULL, -- e.g. '15_days_alert', '30_days_hold', '45_days_legal', '60_days_lockout'
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  authorized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_communication_sent BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active', -- 'active' or 'resolved'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_escalations_milestone ON payment_escalations(payment_milestone_id);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_project ON payment_escalations(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_escalations_tenant ON payment_escalations(tenant_id);

-- Add financial_status column to projects if we want to explicitly track financial holds
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='financial_status') THEN
        ALTER TABLE projects ADD COLUMN financial_status VARCHAR(50) DEFAULT 'clear';
    END IF;
END $$;
