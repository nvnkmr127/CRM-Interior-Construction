const { Pool } = require('pg');
require('dotenv').config({ path: '../server/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/crm_db'
});

async function run() {
  try {
    console.log('=== USERS ===');
    const users = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, r.permissions as role_permissions, u.status
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
    `);
    console.log(JSON.stringify(users.rows, null, 2));

    console.log('=== LEADS ===');
    const leads = await pool.query(`
      SELECT id, name, assignee_id, tenant_id, deleted_at, status
      FROM leads
    `);
    console.log(JSON.stringify(leads.rows, null, 2));

    console.log('=== ROLES ===');
    const roles = await pool.query(`
      SELECT id, name, permissions FROM roles
    `);
    console.log(JSON.stringify(roles.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
