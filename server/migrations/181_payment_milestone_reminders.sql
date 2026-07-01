-- Migration: 181_payment_milestone_reminders.sql
-- Description: Add reminder stage tracking for payment milestones automation

ALTER TABLE payment_milestones
  ADD COLUMN IF NOT EXISTS reminder_stage INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;
