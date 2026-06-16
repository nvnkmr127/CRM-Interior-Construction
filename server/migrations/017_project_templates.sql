CREATE TABLE IF NOT EXISTS project_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  project_type VARCHAR(100),
  description TEXT,
  phases TEXT DEFAULT '[]',
  -- phases structure: [{name, duration_days, milestones:[{name,triggers_payment}]}]
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
