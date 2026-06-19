-- Migration: 053_audit_log_partitioning.sql

-- 1. Rename old table and sequence constraint if any
ALTER TABLE audit_logs RENAME TO audit_logs_old;

-- 2. Create new partitioned table
CREATE TABLE audit_logs (
  id UUID DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_p ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_p ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_p ON audit_logs(user_id);

-- 3. Create initial partitions for current and next year
CREATE TABLE audit_logs_y2026 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE audit_logs_y2027 PARTITION OF audit_logs
    FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- 4. Move data (Handling rows outside partitions if necessary)
-- Because this is a migration, we will only insert rows that fit into the partitions.
-- Any rows before 2026 will be ignored or we could create a catch-all partition.
-- To be safe, we will create a partition for older data.
CREATE TABLE audit_logs_y2025_older PARTITION OF audit_logs
    FOR VALUES FROM ('2000-01-01') TO ('2026-01-01');

INSERT INTO audit_logs SELECT * FROM audit_logs_old;

-- 5. Drop old table
DROP TABLE audit_logs_old;
