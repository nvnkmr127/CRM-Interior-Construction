CREATE TABLE IF NOT EXISTS handover_checklists (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'in_progress',   -- in_progress, signed_off
  signed_by_client_at TEXT,
  client_name VARCHAR(255),
  client_otp_verified BOOLEAN DEFAULT false,
  pdf_key VARCHAR(1000),                       -- S3 key for generated PDF
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS handover_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
  checklist_id TEXT NOT NULL REFERENCES handover_checklists(id) ON DELETE CASCADE,
  room VARCHAR(100),
  description VARCHAR(500) NOT NULL,
  photo_key VARCHAR(1000),
  is_checked BOOLEAN DEFAULT false,
  checked_at TEXT,
  checked_by TEXT REFERENCES users(id)
);
