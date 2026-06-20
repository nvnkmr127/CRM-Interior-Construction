-- Add missing composite indexes for frequently filtered queries

-- Speeds up dashboard stats (Active Leads, Won this month, etc)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_status_del ON leads (tenant_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Speeds up lead listing by stage and assignee
CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage_del ON leads (tenant_id, stage_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_tenant_assignee_del ON leads (tenant_id, assignee_id, deleted_at) WHERE deleted_at IS NULL;

-- Speeds up sorting by creation and updated dates
CREATE INDEX IF NOT EXISTS idx_leads_tenant_created_at ON leads (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_updated_at ON leads (tenant_id, updated_at DESC);

-- Speeds up project queries
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status_del ON projects (tenant_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Speeds up task queries
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee_status_del ON tasks (tenant_id, assignee_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Speeds up timeline/audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_timeline_tenant_lead_created ON lead_timeline (tenant_id, lead_id, created_at DESC);
