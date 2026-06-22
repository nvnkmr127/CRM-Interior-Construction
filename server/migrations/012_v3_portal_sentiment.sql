-- Migration 012: V3 Portal and Sentiment additions

ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT 'Neutral';
