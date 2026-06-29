require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');

async function run() {
  try {
    const tenants = await pool.query('SELECT id, name, slug FROM tenants');
    console.log('Tenants:', tenants.rows);
    const users = await pool.query('SELECT id, name, email, tenant_id FROM users');
    console.log('Users:', users.rows);
  } catch (err) {
    console.error('Failed to query:', err.message);
  } finally {
    await pool.end();
  }
}

run();
