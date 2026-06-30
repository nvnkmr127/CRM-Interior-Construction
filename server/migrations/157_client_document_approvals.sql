-- Migration: 157_client_document_approvals.sql
-- Description: Adds formal approval tracking to documents for the client portal.

ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS client_approval_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, revision_requested
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_revision_requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_revision_note TEXT;

-- For existing documents that were acknowledged, let's mark them as approved if needed, 
-- or leave them pending if we want explicit approval. We'll just leave them, or map it.
-- Let's map acknowledged documents to 'approved' to maintain state logic.
UPDATE documents 
SET client_approval_status = 'approved', client_approved_at = client_acknowledged_at
WHERE client_acknowledged_at IS NOT NULL AND client_approval_status = 'pending';
