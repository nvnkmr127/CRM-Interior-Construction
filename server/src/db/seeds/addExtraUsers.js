const pool = require('../pool').pool || require('../pool');
const { hashPassword } = require('../../services/auth/password');

async function addExtraUsers() {
  try {
    const p = pool.query ? pool : pool.pool; // handle both export formats just in case
    const { rows:[tenant] } = await p.query("SELECT id FROM tenants WHERE slug='demo'");
    if (!tenant) throw new Error('Demo tenant not found');
    const tenantId = tenant.id;

    const { rows:roles } = await p.query("SELECT id,name FROM roles WHERE tenant_id=$1", [tenantId]);
    const roleMap = Object.fromEntries(roles.map(r=>[r.name.toLowerCase(),r.id]));

    const pwHash = await hashPassword('Demo@123');

    // Make sure we have the required roles first
    const requiredRoles = ['QC Engineer', 'Lead Designer', 'Junior Designer', 'Site Engineer', 'Procurement Officer', 'Site Supervisor', 'CRM Executive'];
    for (const role of requiredRoles) {
      if (!roleMap[role.toLowerCase()]) {
        const { rows:[newRole] } = await p.query('INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, $2, $3) RETURNING id', [tenantId, role, '[]']);
        roleMap[role.toLowerCase()] = newRole.id;
        console.log(`Created role: ${role}`);
      }
    }

    const users = [
      { name: 'Arjun P.', email: 'arjun@demo.com', role: 'QC Engineer' },
      { name: 'Rakesh S.', email: 'rakesh@demo.com', role: 'QC Engineer' },
      { name: 'Sanjay D.', email: 'sanjay@demo.com', role: 'Lead Designer' },
      { name: 'Deepak C.', email: 'deepak@demo.com', role: 'Lead Designer' },
      { name: 'Neha V.', email: 'neha@demo.com', role: 'Junior Designer' },
      { name: 'Vikram Singh', email: 'vikram@demo.com', role: 'Site Engineer' },
      { name: 'Rajesh L.', email: 'rajesh@demo.com', role: 'Site Engineer' },
      { name: 'Anita B.', email: 'anita@demo.com', role: 'CRM Executive' },
      { name: 'Karan T.', email: 'karan@demo.com', role: 'Procurement Officer' },
      { name: 'Ramesh K.', email: 'ramesh@demo.com', role: 'Site Supervisor' }
    ];

    for (const u of users) {
      const { rows:[existing] } = await p.query("SELECT id FROM users WHERE email=$1 AND tenant_id=$2", [u.email,tenantId]);
      if (existing) continue;
      await p.query(
        'INSERT INTO users (tenant_id,name,email,password_hash,role_id,status) VALUES ($1,$2,$3,$4,$5,$6)',
        [tenantId, u.name, u.email, pwHash, roleMap[u.role.toLowerCase()], 'active']
      );
      console.log(`Added user: ${u.name}`);
    }

    console.log('Successfully added extra mock users to Postgres!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

addExtraUsers();
