-- Add full-text search capability to Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(phone, '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_leads_search_vector ON leads USING GIN (search_vector);

-- Add full-text search capability to Projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(client_name, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_projects_search_vector ON projects USING GIN (search_vector);

-- Add full-text search capability to Tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A')
) STORED;

CREATE INDEX IF NOT EXISTS idx_tasks_search_vector ON tasks USING GIN (search_vector);

-- Add full-text search capability to Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_users_search_vector ON users USING GIN (search_vector);

-- Add full-text search capability to Contacts
ALTER TABLE lead_contacts ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(phone, '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS idx_lead_contacts_search_vector ON lead_contacts USING GIN (search_vector);
