const pool = require('./src/db/pool');

async function migrate() {
  try {
    console.log('Running audit_logs migration...');
    
    // Add columns
    await pool.query(`
      ALTER TABLE audit_logs 
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS browser VARCHAR(100),
      ADD COLUMN IF NOT EXISTS device VARCHAR(100)
    `);
    
    // Create trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are forbidden.';
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Create trigger for UPDATE
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_prevent_audit_log_update ON audit_logs;
      CREATE TRIGGER trg_prevent_audit_log_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_modification();
    `);
    
    // Create trigger for DELETE
    await pool.query(`
      DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete ON audit_logs;
      CREATE TRIGGER trg_prevent_audit_log_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_modification();
    `);

    console.log('Migration successful: Immutability triggers and columns added.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
