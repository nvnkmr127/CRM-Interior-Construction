-- Migration: 046_alter_tasks_and_documents.sql

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE documents ALTER COLUMN project_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_docs_lead ON documents(lead_id);
