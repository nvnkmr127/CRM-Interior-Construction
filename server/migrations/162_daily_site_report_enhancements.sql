-- Migration: 162_daily_site_report_enhancements.sql
-- Description: Enhances daily site reports to include tomorrows_plan and supervisor_signature.

ALTER TABLE daily_site_reports
ADD COLUMN tomorrows_plan TEXT,
ADD COLUMN supervisor_signature TEXT;
