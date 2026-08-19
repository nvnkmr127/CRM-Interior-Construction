const pool = require('../src/db/pool');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');

async function check() {
  try {
    const res = await pool.query('SELECT * FROM sessions ORDER BY last_active_at DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log('No sessions found');
      return;
    }
    const session = res.rows[0];
    console.log('Session user ID:', session.user_id);
    
    // Let's check user in DB
    const userRes = await pool.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1', [session.user_id]);
    console.log('DB User role_name:', userRes.rows[0].role_name);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
