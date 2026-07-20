ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS browser VARCHAR(255);

CREATE OR REPLACE FUNCTION log_financial_approval_creation()
RETURNS TRIGGER AS \$\$
BEGIN
  INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address, browser)
  VALUES (NEW.tenant_id, NEW.requested_by, 'Created', 'financial_approval', NEW.id, NULL, row_to_json(NEW)::text, 'System', 'System');
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_approval_created ON financial_approvals;
CREATE TRIGGER trg_financial_approval_created
AFTER INSERT ON financial_approvals
FOR EACH ROW
EXECUTE FUNCTION log_financial_approval_creation();

