require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const pool = require('./src/config/db');

async function test() {
  try {
    const res = await pool.query('SELECT last_active_at FROM sessions LIMIT 1');
    console.log('SUCCESS, column exists:', res.rows);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    pool.end();
  }
}
test();
