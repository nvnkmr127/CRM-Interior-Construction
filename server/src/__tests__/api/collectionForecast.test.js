const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Collection Forecast Analytics API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let milestone1; // Overdue
  let milestone2; // Projected
  let milestone3; // Collected

  beforeAll(async () => {
    // 1. Log in as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create active project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'Active Forecast Project', 'Forecast Client', '5555555555', 'forecast@client.com', 'active', 60000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create Overdue Milestone (unpaid past date: expected outstanding 15000)
    const ms1 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, paid_amount)
      VALUES ($1, $2, 'Base Foundation Milestone', 20000.00, CURRENT_DATE - 5, 'overdue', 5000.00)
      RETURNING id
    `, [tenantId, projectId]);
    milestone1 = ms1.rows[0].id;

    // 4. Create Projected Milestone (unpaid future date: expected outstanding 30000)
    const ms2 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, paid_amount)
      VALUES ($1, $2, 'Handover Milestone', 30000.00, CURRENT_DATE + 15, 'scheduled', 0.00)
      RETURNING id
    `, [tenantId, projectId]);
    milestone2 = ms2.rows[0].id;

    // 5. Create Collected Milestone (paid: expected collected 10000)
    const ms3 = await pool.query(`
      INSERT INTO payment_milestones (tenant_id, project_id, name, amount, due_date, status, paid_amount)
      VALUES ($1, $2, 'Signoff Milestone', 10000.00, CURRENT_DATE - 10, 'paid', 10000.00)
      RETURNING id
    `, [tenantId, projectId]);
    milestone3 = ms3.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM payment_milestones WHERE id IN ($1, $2, $3)', [milestone1, milestone2, milestone3]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve payment collection forecast and perform correct aggregates', async () => {
    const res = await request(app)
      .get('/api/analytics/collection-forecast')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const summary = res.body.data.summary;
    // Overdue outstanding = 20000 - 5000 = 15000
    // Projected outstanding = 30000 - 0 = 30000
    // Collected amount = 10000
    expect(summary.totalOverdue).toBeGreaterThanOrEqual(15000);
    expect(summary.totalProjected).toBeGreaterThanOrEqual(30000);
    expect(summary.totalCollected).toBeGreaterThanOrEqual(10000);

    const activeProjectMilestones = res.body.data.milestones.filter(m => m.projectId === projectId);
    expect(activeProjectMilestones.length).toBe(3);

    const overdueItem = activeProjectMilestones.find(m => m.id === milestone1);
    expect(overdueItem.inflowSegment).toBe('overdue');
    expect(overdueItem.outstandingAmount).toBe(15000);

    const projectedItem = activeProjectMilestones.find(m => m.id === milestone2);
    expect(projectedItem.inflowSegment).toBe('projected');
    expect(projectedItem.outstandingAmount).toBe(30000);

    const collectedItem = activeProjectMilestones.find(m => m.id === milestone3);
    expect(collectedItem.inflowSegment).toBe('collected');
    expect(collectedItem.outstandingAmount).toBe(0);
    expect(collectedItem.paidAmount).toBe(10000);
  });
});
