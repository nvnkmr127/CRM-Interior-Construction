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
