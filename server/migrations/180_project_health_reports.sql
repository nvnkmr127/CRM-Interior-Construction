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
