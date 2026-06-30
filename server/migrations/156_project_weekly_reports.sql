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
