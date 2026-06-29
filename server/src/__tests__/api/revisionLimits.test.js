process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Design Revision Limits and Change Orders API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let drawingNumber = 'ARCH-REV-100';

  beforeAll(async () => {
    // 1. Log in to get staff access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Revision Limit Test Project',
        client_name: 'Limit Client',
        client_phone: '9999999999',
        client_email: 'limit-test@test.com',
        contract_file_key: 'test_key_limit',
        contract_file_name: 'contract_limit.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: 'Revision limit street',
        payment_terms: 'Net 30',
        allowed_design_revisions: 3,
        stage_revision_limits: {
          'Requirement Gathering': 3,
          'Concept Presentation': 3,
          'Concept Approval': 3,
          'Detailed Design': 3,
          'Client Review': 3,
          'Revision Rounds': 3,
          'Design Freeze': 3
        }
      });
    projectId = projRes.body.data.id;

    // Set project status to 'ongoing' to bypass booking lock restrictions
    await pool.query(
      `UPDATE projects 
       SET status = 'ongoing', design_stage = 'Detailed Design' 
       WHERE id = $1`, 
      [projectId]
    );
  });

  afterAll(async () => {
    // Clean up database
    if (projectId) {
      await pool.query('DELETE FROM drawing_register WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_change_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should register initial drawing (count remains 0)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber,
        revisionCode: 'R0',
        title: 'Floor Plan Draft',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29'
      });

    expect(res.status).toBe(201);
    
    const projRes = await pool.query('SELECT stage_revision_counts FROM projects WHERE id = $1', [projectId]);
    const counts = projRes.rows[0].stage_revision_counts;
    expect(counts['Detailed Design'] || 0).toBe(0);
  });

  it('should upload revision R1 (increments stage counter to 1)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber,
        revisionCode: 'R1',
        title: 'Floor Plan R1',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29'
      });

    expect(res.status).toBe(201);
    
    const projRes = await pool.query('SELECT stage_revision_counts FROM projects WHERE id = $1', [projectId]);
    const counts = projRes.rows[0].stage_revision_counts;
    expect(counts['Detailed Design']).toBe(1);
  });

  it('should upload revision R2 (reaches limit - 1 (2), trigger warning alert)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber,
        revisionCode: 'R2',
        title: 'Floor Plan R2',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29'
      });

    expect(res.status).toBe(201);
    
    const projRes = await pool.query('SELECT stage_revision_counts FROM projects WHERE id = $1', [projectId]);
    const counts = projRes.rows[0].stage_revision_counts;
    expect(counts['Detailed Design']).toBe(2);
  });

  it('should upload revision R3 (reaches limit (3))', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber,
        revisionCode: 'R3',
        title: 'Floor Plan R3',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29'
      });

    expect(res.status).toBe(201);
    
    const projRes = await pool.query('SELECT stage_revision_counts FROM projects WHERE id = $1', [projectId]);
    const counts = projRes.rows[0].stage_revision_counts;
    expect(counts['Detailed Design']).toBe(3);
  });

  it('should upload revision R4 (exceeds limit (4), auto-generate Change Order)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber,
        revisionCode: 'R4',
        title: 'Floor Plan R4',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29'
      });

    expect(res.status).toBe(201);

    const projRes = await pool.query('SELECT stage_revision_counts FROM projects WHERE id = $1', [projectId]);
    const counts = projRes.rows[0].stage_revision_counts;
    expect(counts['Detailed Design']).toBe(4);

    // Verify change order creation
    const coRes = await pool.query(
      `SELECT * FROM project_change_orders 
       WHERE project_id = $1 AND title LIKE 'Excess Revision%'`,
      [projectId]
    );

    expect(coRes.rows.length).toBe(1);
    expect(coRes.rows[0].status).toBe('draft');
    expect(Number(coRes.rows[0].amount)).toBe(10000);
    expect(coRes.rows[0].reason).toContain('revision limit exceeded');
  });
});
