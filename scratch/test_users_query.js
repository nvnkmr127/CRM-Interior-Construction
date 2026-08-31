const pool = require('../server/src/config/db');

async function run() {
  try {
    const tenantId = 'demo-tenant-id'; // Let's use some tenantId or select one from DB
    
    // First, let's get a real tenant_id from the database
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    if (tenantRes.rows.length === 0) {
      console.log("No tenants found");
      process.exit(1);
    }
    const realTenantId = tenantRes.rows[0].id;
    console.log("Using tenant_id:", realTenantId);

    const query = `
      SELECT u.*, r.name as role_name, r.permissions
      FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.tenant_id=$1 AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT $2
      OFFSET $3
    `;
    const params = [realTenantId, 50, 0];
    
    const { rows } = await pool.query(query, params);
    console.log("Query success! Number of users:", rows.length);
    process.exit(0);
  } catch (error) {
    console.error("Query failed with error:", error);
    process.exit(1);
  }
}

run();
