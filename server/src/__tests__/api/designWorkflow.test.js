const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Project Design Stage Workflow & Gate Checks', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let _userId;
  let projectId;

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID and user ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // 2. Create a clean project to test design stages
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, status, is_scope_locked, design_stage)
      VALUES ($1, 'Workflow Test Project', 'Jane Doe', 'active', false, 'Requirement Gathering')
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_design_stage_history WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM design_assets WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_design_requirements WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('fails transition to Concept Presentation if design brief is not saved', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Concept Presentation' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('STAGE_GATE_FAILED');
  });

  it('passes Concept Presentation gate once design brief is saved', async () => {
    // 1. Save design brief requirements
    await pool.query(`
      INSERT INTO project_design_requirements (tenant_id, project_id, interior_style)
      VALUES ($1, $2, 'Scandinavian')
    `, [tenantId, projectId]);

    // 2. Try transition again
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Concept Presentation', comments: 'Design brief completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.current_stage).toBe('Concept Presentation');

    // Verify database update
    const projCheck = await pool.query('SELECT design_stage FROM projects WHERE id = $1', [projectId]);
    expect(projCheck.rows[0].design_stage).toBe('Concept Presentation');
  });

  it('fails transition to Concept Approval if no visible mood board exists', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Concept Approval' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('passes Concept Approval transition once visible design asset is uploaded', async () => {
    // 1. Insert a design asset visible to client
    await pool.query(`
      INSERT INTO design_assets (tenant_id, project_id, title, asset_type, status, is_visible_to_client)
      VALUES ($1, $2, 'Mood Board V1', 'mood_board', 'draft', true)
    `, [tenantId, projectId]);

    // 2. Transition should succeed now
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Concept Approval', comments: 'Shared concept board' });

    expect(res.status).toBe(200);
    expect(res.body.data.current_stage).toBe('Concept Approval');
  });

  it('fails transition to Detailed Design if concept is not approved', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Detailed Design' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('approves concept and auto-progresses to Detailed Design when client confirms sign-off', async () => {
    // Call client-confirm which will approve the concept
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/client-confirm`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ comments: 'Client approved the Scandinavian concept!' });

    expect(res.status).toBe(200);
    expect(res.body.data.current_stage).toBe('Detailed Design');

    // Verify DB
    const projCheck = await pool.query('SELECT design_stage FROM projects WHERE id = $1', [projectId]);
    expect(projCheck.rows[0].design_stage).toBe('Detailed Design');
  });

  it('fails transition to Client Review if no detailed drawings exist', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Client Review' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('progresses to Client Review once drawing is uploaded', async () => {
    // 1. Insert detailed drawing
    await pool.query(`
      INSERT INTO documents (tenant_id, project_id, name, doc_type, storage_key, file_size_bytes, mime_type, status)
      VALUES ($1, $2, 'Layout elevation.pdf', 'drawing', 'layouts/elev.pdf', 1024, 'application/pdf', 'pending')
    `, [tenantId, projectId]);

    // 2. Proceed to review
    const res = await request(app)
      .post(`/api/projects/${projectId}/design-workflow/transition`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ to_stage: 'Client Review', comments: 'Detailed layouts uploaded' });

    expect(res.status).toBe(200);
    expect(res.body.data.current_stage).toBe('Client Review');
  });

  it('retrieves detailed workflow status and checklist gates via GET API', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/design-workflow`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.current_stage).toBe('Client Review');
    expect(res.body.data.gates.brief_completed).toBe(true);
    expect(res.body.data.gates.concept_uploaded).toBe(true);
    expect(res.body.data.gates.drawings_uploaded).toBe(true);
    expect(res.body.data.history.length).toBeGreaterThan(0);
  });
});
