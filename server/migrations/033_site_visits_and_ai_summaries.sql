-- Phase 3: Smart Activity & Site Visit Management
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
