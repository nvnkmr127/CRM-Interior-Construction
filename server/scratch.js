const { Pool } = require('pg');
const fallbackUrl = 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb';

const pool = new Pool({
  connectionString: fallbackUrl,
  ssl: { rejectUnauthorized: false }
});

async function checkLeadsDeletedAt() {
  try {
    const q = `SELECT count(id) FROM leads WHERE deleted_at IS NULL`;
    const res = await pool.query(q);
    console.log('Leads OK', res.rows);
  } catch(e) {
    console.error('Leads ERROR:', e.message);
  }
  process.exit(0);
}

checkLeadsDeletedAt();
