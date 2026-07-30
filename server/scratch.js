const { Pool } = require('pg');
const fallbackUrl = 'postgresql://neondb_owner:npg_K0JQzHbZVyU3@ep-noisy-smoke-aw8j01pj-pooler.c-12.us-east-1.aws.neon.tech/neondb';

const pool = new Pool({
  connectionString: fallbackUrl,
  ssl: { rejectUnauthorized: false }
});

async function fixNotifications() {
  try {
    await pool.query('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;');
    console.log('Added read_at to notifications');
    
    // Check it again
    const q = `SELECT count(id) FROM notifications WHERE read_at IS NULL`;
    const res = await pool.query(q);
    console.log('Notifications OK', res.rows);
  } catch(e) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
}

fixNotifications();
