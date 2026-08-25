const pool = require('../src/db/pool');

async function check() {
  try {
    const { rows: users } = await pool.query(`
      SELECT u.id, u.name, u.email, u.password_hash, u.status, r.name as role_name 
      FROM users u 
      LEFT JOIN roles r ON u.role_id = r.id
    `);
    console.log('--- USERS IN DATABASE ---');
    console.log(users);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    await pool.readPool.end();
  }
}

check();
