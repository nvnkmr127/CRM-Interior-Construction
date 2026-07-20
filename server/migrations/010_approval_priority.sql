
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT c.conname, t.relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public' 
          AND t.relname = 'financial_approvals'
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%priority%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.relname) || ' DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END \$\$;

UPDATE financial_approvals SET priority = 'critical' WHERE priority = 'urgent';

UPDATE financial_approvals SET priority = 'low' WHERE amount < 1000 AND (priority IS NULL OR priority = 'medium');
UPDATE financial_approvals SET priority = 'medium' WHERE amount >= 1000 AND amount < 5000 AND (priority IS NULL OR priority = 'medium');
UPDATE financial_approvals SET priority = 'high' WHERE amount >= 5000 AND amount < 20000 AND (priority IS NULL OR priority = 'medium');
UPDATE financial_approvals SET priority = 'critical' WHERE amount >= 20000 AND (priority IS NULL OR priority = 'medium');

ALTER TABLE financial_approvals ADD CONSTRAINT financial_approvals_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical'));

