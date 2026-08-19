const pool = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Starting seed...');

    // 1. Create Tenant
    let tenantRes = await client.query(`SELECT id FROM tenants LIMIT 1`);
    let tenantId;
    if (tenantRes.rows.length === 0) {
      tenantRes = await client.query(`INSERT INTO tenants (name, slug, is_active) VALUES ('Demo Corp', 'demo-corp', true) RETURNING id`);
    }
    tenantId = tenantRes.rows[0].id;
    console.log(`Tenant ID: ${tenantId}`);

    // 2. Roles
    const roles = ['Superadmin', 'Admin', 'Sales', 'Project Manager', 'Developer'];
    const roleIds = {};
    for (const r of roles) {
      let roleRes = await client.query(`SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`, [r, tenantId]);
      if (roleRes.rows.length === 0) {
         roleRes = await client.query(`INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, $2, '[]'::jsonb) RETURNING id`, [tenantId, r]);
      }
      roleIds[r] = roleRes.rows[0].id;
    }

    // 3. Users
    const pwd = await bcrypt.hash('password', 10);
    const usersToCreate = [
      { name: 'Alice Admin', email: 'admin@mock.com', role: 'Admin' },
      { name: 'Amit S.', email: 'amit@mock.com', role: 'Sales' },
      { name: 'Bob Sales', email: 'bob@mock.com', role: 'Sales' },
      { name: 'Ravi Developer', email: 'ravi@mock.com', role: 'Developer' }
    ];
    const userIds = {};
    for (const u of usersToCreate) {
      let userRes = await client.query(`SELECT id FROM users WHERE email = $1`, [u.email]);
      if (userRes.rows.length === 0) {
        userRes = await client.query(`
          INSERT INTO users (tenant_id, role_id, name, email, password_hash, status) 
          VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id
        `, [tenantId, roleIds[u.role], u.name, u.email, pwd]);
      }
      userIds[u.name] = userRes.rows[0].id;
    }
    console.log(`Users seeded.`);

    // 4. Tags
    const tagsToCreate = [
      { name: 'Urgent', color: '#ef4444' },
      { name: 'Design', color: '#8b5cf6' },
      { name: 'Procurement', color: '#3b82f6' }
    ];
    for (const t of tagsToCreate) {
      await client.query(`INSERT INTO tags (tenant_id, name, color) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [tenantId, t.name, t.color]);
    }

    // 5. Leads & Projects
    const leads = [
      { project_name: 'Smith Villa Renovation', client_name: 'John Smith' },
      { project_name: 'Jenkins Penthouse', client_name: 'Sarah Jenkins' }
    ];
    const projectIds = {};
    for (const l of leads) {
      // Create Lead
      let leadRes = await client.query(`SELECT id FROM leads WHERE name = $1`, [l.client_name]);
      if (leadRes.rows.length === 0) {
        leadRes = await client.query(`
          INSERT INTO leads (tenant_id, name, property_type, status) 
          VALUES ($1, $2, 'Residential', 'Won') RETURNING id
        `, [tenantId, l.client_name]);
      }
      const leadId = leadRes.rows[0].id;

      // Create Project
      let projRes = await client.query(`SELECT id FROM projects WHERE lead_id = $1`, [leadId]);
      if (projRes.rows.length === 0) {
        projRes = await client.query(`
          INSERT INTO projects (tenant_id, lead_id, name, client_name, status, start_date) 
          VALUES ($1, $2, $3, $4, 'in_progress', CURRENT_DATE) RETURNING id
        `, [tenantId, leadId, l.project_name, l.client_name]);
      }
      projectIds[l.project_name] = projRes.rows[0].id;
    }
    console.log('Projects seeded.');

    // 6. Tasks
    await client.query(`DELETE FROM tasks WHERE title LIKE 'Review interior design%' OR title LIKE 'Procure Italian marble%'`);
    
    await client.query(`
      INSERT INTO tasks (tenant_id, project_id, title, description, assignee_id, due_date, priority, status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + INTERVAL '1 day', 'high', 'in_progress')
    `, [tenantId, projectIds['Smith Villa Renovation'], 'Review interior design blueprints for Smith Villa', 'Check the master bedroom lighting layout.', userIds['Alice Admin']]);

    await client.query(`
      INSERT INTO tasks (tenant_id, project_id, title, description, assignee_id, due_date, priority, status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_DATE - INTERVAL '1 day', 'urgent', 'todo')
    `, [tenantId, projectIds['Jenkins Penthouse'], 'Procure Italian marble for living room', 'Vendor needs confirmation by EOD.', userIds['Bob Sales']]);

    console.log('Tasks seeded.');

    await client.query('COMMIT');
    console.log('Seed completed successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
