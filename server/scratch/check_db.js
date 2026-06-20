const pool = require('../src/db/pool');

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        email_sla_breaches BOOLEAN DEFAULT true,
        push_score_changes BOOLEAN DEFAULT true,
        dnd_start_time VARCHAR(10) DEFAULT '22:00',
        dnd_end_time VARCHAR(10) DEFAULT '08:00',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table user_preferences created successfully.');
  } catch (err) {
    console.error('Failed to create table:', err.message);
  } finally {
    pool.end();
  }
}

createTable();
