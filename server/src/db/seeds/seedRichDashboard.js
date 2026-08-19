const { pool } = require('../pool');

async function seedRich() {
  console.log('Seeding rich dashboard data...');
  const { rows:[tenant] } = await pool.query("SELECT id FROM tenants WHERE slug='demo'");
  if (!tenant) return;
  const tenantId = tenant.id;

  const { rows:users } = await pool.query("SELECT id, email FROM users WHERE tenant_id=$1", [tenantId]);
  const ananyaId = users.find(u => u.email === 'ananya@demo.com')?.id;
  const adminId = users.find(u => u.email === 'admin@demo.com')?.id;
  
  const { rows:projects } = await pool.query("SELECT id FROM projects WHERE tenant_id=$1 LIMIT 2", [tenantId]);
  const p1 = projects[0]?.id;
  const p2 = projects[1]?.id;

  const { rows:leads } = await pool.query("SELECT id, name FROM leads WHERE tenant_id=$1 LIMIT 2", [tenantId]);
  const l1 = leads[0]?.id;

  if (p1) {
    // Tasks
    await pool.query(`INSERT INTO tasks (tenant_id, project_id, title, description, assignee_id, status, priority, due_date, created_by) VALUES 
      ($1, $2, 'Review interior design blueprints for Smith Villa', 'Check the master bedroom lighting layout', $3, 'in_progress', 'high', CURRENT_DATE, $4),
      ($1, $2, 'Procure Italian marble for living room', 'Vendor needs confirmation by EOD', $3, 'todo', 'urgent', CURRENT_DATE - INTERVAL '1 day', $4) ON CONFLICT DO NOTHING`,
      [tenantId, p1, ananyaId, adminId]);

    // Payment Milestones
    await pool.query(`INSERT INTO payment_milestones (tenant_id, project_id, name, amount, status, due_date) VALUES 
      ($1, $2, 'Advance Payment', 150000, 'pending', CURRENT_DATE - INTERVAL '2 days'),
      ($1, $2, 'Material Procurement', 350000, 'pending', CURRENT_DATE + INTERVAL '5 days') ON CONFLICT DO NOTHING`,
      [tenantId, p1]);
  }

  // Activities
  if (l1) {
    await pool.query(`INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, new_value) VALUES 
      ($1, $2, 'lead.stage_changed', 'lead', $3, '{"stageName": "Quotation"}'),
      ($1, $2, 'task.created', 'task', null, '{"title": "Call customer for requirement gathering"}') ON CONFLICT DO NOTHING`,
      [tenantId, ananyaId, l1]);
  }

  console.log('Done!');
  process.exit(0);
}

seedRich().catch(console.error);
