-- Transform audit_logs into a declarative partitioned table
-- Note: In PostgreSQL, we cannot simply ALTER TABLE audit_logs PARTITION BY.
-- We must create a new partitioned table, move data, and rename.

-- 1. Rename existing table
ALTER TABLE audit_logs RENAME TO audit_logs_old;

-- 2. Create new partitioned table
CREATE TABLE audit_logs (
    id SERIAL,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    entity VARCHAR(255) NOT NULL,
    entity_id INTEGER NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at) -- Partition key must be part of PK
) PARTITION BY RANGE (created_at);

-- 3. Create partitions for current and next few months (assuming we are in mid 2026)
CREATE TABLE audit_logs_y2026m05 PARTITION OF audit_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_y2026m06 PARTITION OF audit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_y2026m07 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_y2026m08 PARTITION OF audit_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- Default partition for anything else
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- 4. Move data from old table to new partitioned table
INSERT INTO audit_logs (id, tenant_id, user_id, action, entity, entity_id, old_value, new_value, created_at)
SELECT id, tenant_id, user_id, action, entity, entity_id, old_value, new_value, created_at 
FROM audit_logs_old;

-- 5. Recreate indexes on the new partitioned table
CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs (tenant_id, entity, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Optional: Drop old table once confident
-- DROP TABLE audit_logs_old;
