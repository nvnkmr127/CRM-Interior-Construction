-- Add columns for extended tracking
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
ADD COLUMN IF NOT EXISTS device VARCHAR(100);

-- Create trigger function
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

-- Create trigger for UPDATE
DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- Create trigger for DELETE
DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_log_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
