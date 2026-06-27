-- Migration: 112_document_client_acknowledgment.sql
-- Description: Add columns for client document acknowledgment tracking.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_acknowledged_at TIMESTAMP;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_acknowledged_by VARCHAR(255);
