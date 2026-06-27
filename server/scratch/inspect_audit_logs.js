const pool = require('../src/db/pool');

async function run() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
      ORDER BY ordinal_position
    `);
    console.log('Columns of audit_logs table:');
    console.table(res.rows);
  } catch (err) {
    console.error('Failed to query table info:', err);
  } finally {
    await pool.end();
  }
}

run();
