const { pool } = require('./server/src/config/db');
async function check() {
  const { rows } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', rows.map(r => r.table_name).filter(t => t.includes('activit') || t.includes('log')));
  process.exit(0);
}
check();
