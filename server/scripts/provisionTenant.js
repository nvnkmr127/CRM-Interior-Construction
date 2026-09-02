require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/db/pool');
const { registerUser } = require('../src/services/auth/register');
const { PLAN_DEFAULTS, getModulesForTabs } = require('../src/constants/permissions');

async function provisionTenant() {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.error('Usage: node server/scripts/provisionTenant.js <name> <slug> <adminEmail> <adminName> <adminPassword> [plan]');
    process.exit(1);
  }

  const [name, slug, adminEmail, adminName, adminPassword, planArg] = args;
  const plan = (planArg || 'starter').toLowerCase();
  const planTabs = PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.starter;
  const allowedModules = getModulesForTabs(planTabs).map(m => m.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create Tenant (Organization)
    const tenantRes = await client.query(
      `INSERT INTO tenants (name, slug, plan) VALUES ($1, $2, $3) 
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, plan = EXCLUDED.plan RETURNING id`,
      [name, slug, plan]
    );
    const tenantId = tenantRes.rows[0].id;
    console.log(`Tenant created/retrieved: "${name}" with slug "${slug}". ID: ${tenantId}`);

    // 2. Initialize Tenant Security Settings
    await client.query(
      `INSERT INTO tenant_security_settings (tenant_id, session_timeout_minutes, concurrent_login_limit)
       VALUES ($1, 120, 3) 
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId]
    );
    console.log('Default security settings initialized for tenant.');

    // 3. Create Default Superadmin Role scoped to plan
    const { rows } = await client.query(
      `INSERT INTO roles (tenant_id, name, permissions, is_system)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        tenantId,
        'superadmin',
        JSON.stringify({
          actions: ['*'],
          modules: allowedModules,
          scopes: {},
          fields: {},
          pages: {}
        }),
        true
      ]
    );
    const adminRoleId = rows[0].id;
    console.log('Superadmin role created successfully.');

    // Commit role transaction first so registerUser query can reference the role
    await client.query('COMMIT');

    // 4. Create Admin User belonging to the Tenant
    // Since registerUser manages its own transaction and queries inside, we call it separately.
    const newUser = await registerUser({
      tenantId,
      email: adminEmail,
      name: adminName,
      password: adminPassword,
      roleId: adminRoleId
    });

    console.log(`Admin User successfully created: "${adminName}" (${adminEmail}) ID: ${newUser.id}`);
    console.log(`\x1b[32mSuccessfully provisioned tenant: "${name}" (${slug})\x1b[0m`);
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to provision tenant:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

provisionTenant();
