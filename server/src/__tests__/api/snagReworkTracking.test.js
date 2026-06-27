const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Snag Rework Tracking API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let assigneeId;
  let snagId;

  beforeAll(async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Fetch admin user id for assignee
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    assigneeId = userRes.rows[0].id;

    // 3. Create test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Rework Test Project', 'Snag Client', '9999999990', 'snag@test.com', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM snags WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  beforeEach(async () => {
    // Create an open snag
    const snagRes = await pool.query(
      `INSERT INTO snags (tenant_id, project_id, title, description, category, status)
       VALUES ($1, $2, 'Loose kitchen cabinet doors', 'Cabinet doors are loose and misaligned.', 'carpentry', 'open')
       RETURNING id`,
      [tenantId, projectId]
    );
    snagId = snagRes.rows[0].id;
  });

  afterEach(async () => {
    await pool.query('DELETE FROM snags WHERE id = $1', [snagId]);
  });

  it('allows workflow transition and logs rework details upon snag resolution', async () => {
    // Step 1: Assign the snag
    const assignRes = await request(app)
      .patch(`/api/snags/${snagId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ assigneeId });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.status).toBe('assigned');
    expect(assignRes.body.data.assignee_id).toBe(assigneeId);

    // Step 2: Start work
    const startRes = await request(app)
      .patch(`/api/snags/${snagId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'in_progress' });

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('in_progress');

    // Step 3: Resolve snag and log rework tracking
    const resolveRes = await request(app)
      .patch(`/api/snags/${snagId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'resolved',
        resolutionNote: 'Re-tightened hinge screws, aligned doors, replaced 1 damaged bracket.',
        reworkRequired: true,
        reworkRootCauseCategory: 'workmanship_error',
        reworkEstimatedHours: 2.0,
        reworkActualHours: 2.5,
        reworkCost: 450.00
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe('resolved');
    expect(resolveRes.body.data.rework_required).toBe(true);
    expect(resolveRes.body.data.rework_root_cause_category).toBe('workmanship_error');
    expect(parseFloat(resolveRes.body.data.rework_estimated_hours)).toBe(2.0);
    expect(parseFloat(resolveRes.body.data.rework_actual_hours)).toBe(2.5);
    expect(parseFloat(resolveRes.body.data.rework_cost)).toBe(450.00);
    expect(resolveRes.body.data.rework_completed_at).toBeDefined();

    // Verify in DB directly
    const dbRes = await pool.query('SELECT * FROM snags WHERE id = $1', [snagId]);
    const snag = dbRes.rows[0];
    expect(snag.status).toBe('resolved');
    expect(snag.rework_required).toBe(true);
    expect(snag.rework_root_cause_category).toBe('workmanship_error');
    expect(parseFloat(snag.rework_estimated_hours)).toBe(2.0);
    expect(parseFloat(snag.rework_actual_hours)).toBe(2.5);
    expect(parseFloat(snag.rework_cost)).toBe(450.00);
    expect(snag.rework_completed_at).not.toBeNull();
  });
});
