const pool = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function seedRealDemo() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Starting heavy seed...');

    // 1. Get or Create Tenant 'demo'
    await client.query(`UPDATE tenants SET slug = slug || '_' || id WHERE slug = 'demo'`);
    let tenantRes = await client.query(`INSERT INTO tenants (name, slug, is_active) VALUES ('Demo Workspace', 'demo', true) RETURNING id`);
    const tenantId = tenantRes.rows[0].id;
    console.log(`Tenant ID: ${tenantId}`);

    // 2. Roles
    const roles = ['Superadmin', 'Admin', 'Sales', 'Project Manager', 'Developer', 'Designer'];
    const roleIds = {};
    for (const r of roles) {
      let roleRes = await client.query(`SELECT id FROM roles WHERE name = $1 AND tenant_id = $2`, [r, tenantId]);
      if (roleRes.rows.length === 0) {
         roleRes = await client.query(`INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, $2, '["*"]'::jsonb) RETURNING id`, [tenantId, r]);
      }
      roleIds[r] = roleRes.rows[0].id;
    }

    // 3. Users
    const pwd = await bcrypt.hash('Demo@123', 10);
    const usersToCreate = [
      { name: 'Admin', email: 'admin@demo.com', role: 'Admin' },
      { name: 'Priya (PM)', email: 'priya@demo.com', role: 'Project Manager' },
      { name: 'Rahul (Designer)', email: 'rahul@demo.com', role: 'Designer' },
      { name: 'Ananya (Sales)', email: 'ananya@demo.com', role: 'Sales' },
      { name: 'Arjun (QC)', email: 'arjun@demo.com', role: 'Developer' },
      { name: 'Vikram (Site)', email: 'vikram@demo.com', role: 'Developer' }
    ];
    const userIds = {};
    for (const u of usersToCreate) {
      let userRes = await client.query(`SELECT id FROM users WHERE email = $1 AND tenant_id = $2`, [u.email, tenantId]);
      if (userRes.rows.length === 0) {
        userRes = await client.query(`
          INSERT INTO users (tenant_id, role_id, name, email, password_hash, status) 
          VALUES ($1, $2, $3, $4, $5, 'active') RETURNING id
        `, [tenantId, roleIds[u.role], u.name, u.email, pwd]);
      }
      userIds[u.name] = userRes.rows[0].id;
    }

    // 3.5. Ensure Lead Stages Exist
    let leadStagesRes = await client.query(`SELECT id, name FROM lead_stages WHERE tenant_id = $1`, [tenantId]);
    if (leadStagesRes.rows.length === 0) {
      const defaultStages = [
        { name: 'New', is_won: false },
        { name: 'Contacted', is_won: false },
        { name: 'Qualified', is_won: false },
        { name: 'Proposal', is_won: false },
        { name: 'Won', is_won: true },
        { name: 'Lost', is_won: false }
      ];
      for (let i = 0; i < defaultStages.length; i++) {
        await client.query(`INSERT INTO lead_stages (tenant_id, name, is_won, sort_order) VALUES ($1, $2, $3, $4)`, 
          [tenantId, defaultStages[i].name, defaultStages[i].is_won, i + 1]);
      }
      leadStagesRes = await client.query(`SELECT id, name FROM lead_stages WHERE tenant_id = $1`, [tenantId]);
    }
    const leadStagesMap = leadStagesRes.rows;

    // 4. Leads (Dozens of leads in various stages)
    const userIdsArr = Object.values(userIds);
    const leadIds = [];
    for (let i = 1; i <= 30; i++) {
      const stage = leadStagesMap[Math.floor(Math.random() * leadStagesMap.length)];
      const assigneeId = userIdsArr[Math.floor(Math.random() * userIdsArr.length)];
      let status = 'active';
      if (stage.name === 'Won') status = 'won';
      else if (stage.name === 'Lost') status = 'lost';
      
      const res = await client.query(`
        INSERT INTO leads (tenant_id, name, property_type, status, stage_id, assignee_id, budget_max)
        VALUES ($1, $2, 'Residential', $3, $4, $5, $6) RETURNING id
      `, [tenantId, `Lead Property ${i}`, status, stage.id, assigneeId, (Math.floor(Math.random() * 50) + 10) * 10000]);
      leadIds.push(res.rows[0].id);
    }
    console.log(`Seeded 30 Leads.`);

    // 5. Projects (20 projects)
    const projectIds = [];
    for (let i = 1; i <= 20; i++) {
      // Pick a random 'Won' lead if possible, else just use the first lead
      const status = i % 5 === 0 ? 'completed' : (i % 7 === 0 ? 'on_hold' : 'in_progress');
      const startOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
      const endOffset = startOffset + 30 + Math.floor(Math.random() * 60);

      const res = await client.query(`
        INSERT INTO projects (tenant_id, lead_id, name, client_name, status, start_date, target_date)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + $6 * INTERVAL '1 day', CURRENT_DATE + $7 * INTERVAL '1 day')
        RETURNING id
      `, [tenantId, leadIds[i % leadIds.length], `Project Alpha ${i}`, `Client Name ${i}`, status, startOffset, endOffset]);
      projectIds.push(res.rows[0].id);
    }
    console.log(`Seeded 20 Projects.`);

    // 6. Payments (Over last 12 weeks to populate revenue trend)
    let totalRevenue = 0;
    for (let i = 0; i < 50; i++) {
      const projectId = projectIds[i % projectIds.length];
      const amount = (Math.floor(Math.random() * 50) + 10) * 10000; // 100k to 600k
      // Random date in the last 12 weeks
      const daysAgo = Math.floor(Math.random() * 84);
      totalRevenue += amount;
      await client.query(`
        INSERT INTO payment_milestones (tenant_id, project_id, name, amount, paid_amount, status, due_date, paid_at)
        VALUES ($1, $2, $3, $4, $4, 'paid', CURRENT_DATE - $5 * INTERVAL '1 day', CURRENT_DATE - $5 * INTERVAL '1 day')
      `, [tenantId, projectId, `Milestone Payment ${i}`, amount, daysAgo]);
    }
    
    // Add some due/overdue payments
    for (let i = 0; i < 10; i++) {
      const projectId = projectIds[i % projectIds.length];
      const amount = 50000;
      const daysOffset = Math.floor(Math.random() * 20) - 10; // -10 to +10 days
      await client.query(`
        INSERT INTO payment_milestones (tenant_id, project_id, name, amount, status, due_date)
        VALUES ($1, $2, $3, $4, 'pending', CURRENT_DATE + $5 * INTERVAL '1 day')
      `, [tenantId, projectId, `Pending Payment ${i}`, amount, daysOffset]);
    }
    console.log(`Seeded Payments.`);

    // 7. Tasks (50+ tasks)
    for (let i = 1; i <= 60; i++) {
      const projectId = projectIds[i % projectIds.length];
      const assigneeId = userIdsArr[i % userIdsArr.length];
      const status = i % 3 === 0 ? 'done' : (i % 2 === 0 ? 'in_progress' : 'todo');
      const priority = i % 4 === 0 ? 'urgent' : 'medium';
      const daysOffset = Math.floor(Math.random() * 14) - 7;
      
      await client.query(`
        INSERT INTO tasks (tenant_id, project_id, title, description, assignee_id, due_date, priority, status)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + $6 * INTERVAL '1 day', $7, $8)
      `, [tenantId, projectId, `Task Item ${i}`, `Detailed description for task ${i}`, assigneeId, daysOffset, priority, status]);
    }
    console.log(`Seeded 60 Tasks.`);

    // 8. Audit Logs (to populate recent activity)
    for (let i = 1; i <= 30; i++) {
      const action = i % 2 === 0 ? 'lead.stage_changed' : 'task.created';
      const entity = i % 2 === 0 ? 'lead' : 'task';
      const leadId = leadIds[i % leadIds.length];
      const daysAgo = Math.floor(Math.random() * 5); // recent

      await client.query(`
        INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, new_value, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP - $7 * INTERVAL '1 day' - $8 * INTERVAL '1 hour')
      `, [
        tenantId, 
        userIdsArr[0], 
        action, 
        entity, 
        leadId, 
        JSON.stringify({ stageName: 'Qualified', message: 'User updated stage to Qualified' }), 
        daysAgo, 
        Math.floor(Math.random() * 12)
      ]);
    }
    console.log(`Seeded Audit Logs.`);

    await client.query('COMMIT');
    console.log('Heavy seed completed successfully! The dashboard should now be fully populated.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedRealDemo();
