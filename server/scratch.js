const { Pool } = require('pg');
const fallbackUrl = 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb';

const pool = new Pool({
  connectionString: fallbackUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkSessions() {
  try {
    const res = await pool.query('SELECT count(id) FROM sessions');
    console.log('Sessions count:', res.rows[0].count);
    const res2 = await pool.query('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5');
    console.log('Recent sessions:', res2.rows.map(r => r.id));
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
}

checkSessions();
