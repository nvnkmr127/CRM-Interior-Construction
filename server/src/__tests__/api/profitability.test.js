const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Profitability Analytics API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let designerId;
  let expenseId1;
  let expenseId2;

  beforeAll(async () => {
    // 1. Log in as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Fetch a user ID for the project
    const userRes = await pool.query(`
      SELECT id FROM users WHERE tenant_id = $1 LIMIT 1
    `, [tenantId]);
    designerId = userRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value, project_type, designer_id)
      VALUES ($1, 'Profitability Test Project', 'Profit Client', '5555555555', 'profit@client.com', 'active', 100000.00, 'Residential', $2)
      RETURNING id
    `, [tenantId, designerId]);
    projectId = projRes.rows[0].id;

    // 3. Create actual expense (Oak timber cost: actual 30,000)
    const exp1 = await pool.query(`
      INSERT INTO project_expenses (tenant_id, project_id, category, type, description, amount, incurred_date)
      VALUES ($1, $2, 'material', 'actual', 'Veneers & timber supply', 30000.00, CURRENT_DATE)
      RETURNING id
    `, [tenantId, projectId]);
    expenseId1 = exp1.rows[0].id;

    // 4. Create committed expense (Carpentry service: committed 10,000)
    const exp2 = await pool.query(`
      INSERT INTO project_expenses (tenant_id, project_id, category, type, description, amount, incurred_date)
      VALUES ($1, $2, 'labour', 'committed', 'Carpentry labour booking', 10000.00, CURRENT_DATE)
      RETURNING id
    `, [tenantId, projectId]);
    expenseId2 = exp2.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_expenses WHERE id IN ($1, $2)', [expenseId1, expenseId2]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve project profitability analytics and verify aggregations', async () => {
    const res = await request(app)
      .get('/api/analytics/profitability')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    
    // Total portfolio levels should include our seeded test project
    expect(data.summary.revenue).toBeGreaterThanOrEqual(100000.00);
    expect(data.summary.actualCost).toBeGreaterThanOrEqual(30000.00);
    expect(data.summary.committedCost).toBeGreaterThanOrEqual(10000.00);

    const testProject = data.projects.find(p => p.projectId === projectId);
    expect(testProject).toBeDefined();
    expect(testProject.projectName).toBe('Profitability Test Project');
    expect(testProject.projectType).toBe('Residential');
    expect(testProject.revenue).toBe(100000.00);
    expect(testProject.actualCost).toBe(30000.00);
    expect(testProject.committedCost).toBe(10000.00);
    
    // actualMargin = 100000 - 30000 = 70000 (70%)
    // committedMargin = 100000 - 10000 = 90000 (90%)
    expect(testProject.actualMargin).toBe(70000.00);
    expect(testProject.actualMarginPercent).toBe(70.0);
    expect(testProject.committedMargin).toBe(90000.00);
    expect(testProject.committedMarginPercent).toBe(90.0);
    expect(testProject.sizeTier).toBe('Small (Under 5L)');

    // Verify aggregations grouped by type contain 'Residential'
    const residentialType = data.byProjectType.find(t => t.name === 'Residential');
    expect(residentialType).toBeDefined();
    expect(residentialType.revenue).toBeGreaterThanOrEqual(100000.00);
    expect(residentialType.actualCost).toBeGreaterThanOrEqual(30000.00);
  });
});
