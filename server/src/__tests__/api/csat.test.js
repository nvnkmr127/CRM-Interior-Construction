const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('CSAT Analytics API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let userId;
  let csatId;

  beforeAll(async () => {
    // 1. Log in
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID and admin user ID (userId)
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    userId = userRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'CSAT Test Project', 'CSAT Client', '5555555555', 'csat@client.com', 'active', 100000.00)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create CSAT feedback entry (Score = 5)
    const csatRes = await pool.query(`
      INSERT INTO csat_feedback (tenant_id, project_id, reference_type, reference_id, score, comments, pm_id, designer_id)
      VALUES ($1, $2, 'handover', gen_random_uuid(), 5, 'Perfect execution and wonderful design!', $3, $3)
      RETURNING id
    `, [tenantId, projectId, userId]);
    csatId = csatRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM csat_feedback WHERE id = $1', [csatId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve CSAT analytics summary, trends, and team member averages', async () => {
    const res = await request(app)
      .get('/api/analytics/csat')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    
    // Summary
    expect(data.summary.avgScore).toBeGreaterThanOrEqual(4.0);
    expect(data.summary.totalSurveys).toBeGreaterThanOrEqual(1);
    expect(data.summary.distribution['5']).toBeGreaterThanOrEqual(1);

    // Trends
    expect(data.trends.length).toBeGreaterThanOrEqual(1);
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const currentMonthTrend = data.trends.find(t => t.month === currentMonthStr);
    expect(currentMonthTrend).toBeDefined();

    // Grouped by project type
    const byType = data.byProjectType;
    expect(byType.length).toBeGreaterThanOrEqual(1);

    // Team Member CSAT average
    const teamMember = data.byTeamMember.find(t => t.userId === userId);
    expect(teamMember).toBeDefined();
    expect(teamMember.avgScore).toBeGreaterThanOrEqual(4.0);
    expect(teamMember.count).toBeGreaterThanOrEqual(1);

    // Feedback list details
    const feedbackList = data.feedbacks;
    const testFeedback = feedbackList.find(f => f.id === csatId);
    expect(testFeedback).toBeDefined();
    expect(testFeedback.score).toBe(5);
    expect(testFeedback.comments).toBe('Perfect execution and wonderful design!');
    expect(testFeedback.projectName).toBe('CSAT Test Project');
    expect(testFeedback.pmName).toBeDefined();
  });
});
