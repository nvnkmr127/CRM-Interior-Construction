const pool = require('../server/src/db/pool');

async function test() {
  try {
    const tenants = await pool.query("SELECT id, name, slug FROM tenants");
    console.log("ALL TENANTS:", tenants.rows);

    const users = await pool.query("SELECT id, tenant_id, name, email FROM users");
    console.log("ALL USERS:", users.rows);

    const leads = await pool.query("SELECT id, tenant_id, name, email FROM leads WHERE name ILIKE '%neha%'");
    console.log("ALL LEADS MATCHING NEHA:", leads.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

test();
