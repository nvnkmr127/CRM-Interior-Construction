const { Pool } = require('pg');
const fallbackUrl = 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb';

const pool = new Pool({
  connectionString: fallbackUrl,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM notifications LIMIT 1');
    console.log('Success notifications:', rows);
  } catch (err) {
    console.error('Error notifications:', err.message);
  }

  process.exit(0);
}

test();
