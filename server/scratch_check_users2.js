const pool = require('./src/db/pool');

async function run() {
  try {
    const tenants = await pool.query('SELECT id, name, slug, is_active FROM tenants');
    console.log('--- TENANTS ---');
    console.log(tenants.rows);

    const users = await pool.query('SELECT id, tenant_id, name, email, status FROM users');
    console.log('--- USERS ---');
    console.log(users.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    await pool.readPool.end();
  }
}

run();
