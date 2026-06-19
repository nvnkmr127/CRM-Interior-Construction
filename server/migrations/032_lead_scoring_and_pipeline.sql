-- Phase 2: AI Lead Scoring and Pipeline Management
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS win_probability INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ai_score_breakdown JSONB DEFAULT '{}'::jsonb;
