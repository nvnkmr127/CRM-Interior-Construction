require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');

async function run() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success connecting to Aiven!', res.rows[0]);
  } catch (err) {
    console.error('Failed to connect to Aiven:', err.message);
  } finally {
    await pool.end();
  }
}

run();
