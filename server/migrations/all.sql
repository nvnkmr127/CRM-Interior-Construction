

-- Migration: 001_tenants.sql

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


-- Migration: 002_users.sql

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


-- Migration: 003_sessions.sql

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


-- Migration: 004_audit_logs.sql

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


-- Migration: 005_leads.sql

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


-- Migration: 006_lead_stages.sql

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


-- Migration: 007_activities.sql

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


-- Migration: 008_lead_scoring_rules.sql

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


-- Migration: 009_projects.sql

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


-- Migration: 010_project_phases.sql

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


-- Migration: 011_milestones.sql

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


-- Migration: 012_tasks.sql

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


-- Migration: 013_task_comments.sql

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);


-- Migration: 014_documents.sql

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


-- Migration: 015_payment_milestones.sql

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


-- Migration: 016_custom_fields_config.sql

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


-- Migration: 017_project_templates.sql

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


-- Migration: 018_automation_rules.sql

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


-- Migration: 018b_automation_jobs.sql

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


-- Migration: 019_api_keys.sql

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


-- Migration: 020_webhooks.sql

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


-- Migration: 020b_webhook_sources.sql

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


-- Migration: 021_snags.sql

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


-- Migration: 022_handover.sql

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


-- Migration: 023_client_portal_users.sql

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


-- Migration: 024_portal_otp_requests.sql

CREATE TABLE IF NOT EXISTS portal_otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_otp_requests_phone_time
  ON portal_otp_requests(phone, requested_at);


-- Migration: 025_add_documents_metadata.sql

ALTER TABLE documents ADD COLUMN metadata TEXT DEFAULT '{}';


-- Migration: 025_notifications.sql

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


-- Migration: 026_notifications.sql

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

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);


-- Migration: 027_fix_lead_score_column.sql

-- Fix score column: was incorrectly created as BOOLEAN, must be INTEGER (0-100 scoring range)
ALTER TABLE leads
  ALTER COLUMN score DROP DEFAULT,
  ALTER COLUMN score TYPE INTEGER USING CASE WHEN score THEN 1 ELSE 0 END,
  ALTER COLUMN score SET DEFAULT 0;

-- 028_lead_files
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

-- 029_lead_followups
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
