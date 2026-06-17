CREATE TABLE IF NOT EXISTS lead_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) DEFAULT '#6B6B6B',
  sort_order BOOLEAN DEFAULT FALSE,
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
