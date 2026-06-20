const pool = require('./src/db/pool');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    let res = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    let tenantId;
    if (res.rows.length === 0) {
      res = await pool.query("INSERT INTO tenants (name, slug) VALUES ('Demo Tenant', 'demo') RETURNING id");
    }
    tenantId = res.rows[0].id;

    const email = 'admin@demo.com';
    const password = await bcrypt.hash('Admin@123', 10);
    
    let uRes = await pool.query("SELECT id FROM users WHERE email = $1 AND tenant_id = $2", [email, tenantId]);
    if (uRes.rows.length === 0) {
      await pool.query("INSERT INTO users (tenant_id, name, email, password_hash, status) VALUES ($1, 'Admin', $2, $3, 'active')", [tenantId, email, password]);
    } else {
      await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2 AND tenant_id = $3", [password, email, tenantId]);
    }
    
    console.log("Seeded test DB successfully.");
    process.exit(0);
  } catch (e) {
    console.error("Error seeding test DB:", e.message);
    process.exit(1);
  }
}

seed();
