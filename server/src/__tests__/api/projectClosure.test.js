const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Closure Checklist API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let tenantId;
  let projectId;

  beforeAll(async () => {
    // 1. Login CRM admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test Closure Project', 'Closure Client', '9998887770', 'closure@client.com', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_closure_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should fetch the closure checklist and auto-create if missing', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/closure-checklist`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checklist).toBeDefined();
    expect(res.body.data.checklist.project_id).toBe(projectId);
    expect(res.body.data.checklist.status).toBe('in_progress');
    expect(res.body.data.autoVerification).toBeDefined();
    expect(res.body.data.autoVerification.financialClearance.passed).toBe(true); // 0 payment milestones = passes
  });

  it('should block project status transition to completed if checklist is incomplete', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('checklist gates must be verified and completed');
  });

  it('should allow updating the checklist gates', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/closure-checklist`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        financial_clearance_completed: true,
        financial_clearance_notes: 'All payments verified.',
        task_completion_completed: true,
        task_completion_notes: 'No remaining tasks.',
        snag_closure_completed: true,
        snag_closure_notes: 'All snags closed.',
        document_archive_completed: true,
        document_archive_notes: 'Docs archived.',
        warranty_activation_completed: true,
        warranty_activation_notes: 'No items require warranty.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checklist.status).toBe('completed');
    expect(res.body.data.checklist.financial_clearance_completed).toBe(true);
    expect(res.body.data.checklist.financial_clearance_notes).toBe('All payments verified.');
  });

  it('should allow project status transition to completed once checklist is complete', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
  });
});
