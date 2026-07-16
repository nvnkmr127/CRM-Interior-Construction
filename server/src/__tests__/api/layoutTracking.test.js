process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Layout Tracking and MEP Checklist API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let _tenantId;
  let projectId;
  let drawingId;
  let mepChecklistItemId;

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
        name: 'Layout Tracking Test Project',
        client_name: 'Test Client',
        client_phone: '8888888888',
        client_email: 'layout-test@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: 'Layout Test Street, Bangalore',
        payment_terms: 'Net 30'
      });
    projectId = projRes.body.data.id;

    // Set project status to 'ongoing' to bypass booking lock restrictions
    await pool.query("UPDATE projects SET status = 'ongoing' WHERE id = $1", [projectId]);
  });

  afterAll(async () => {
    // Clean up database
    if (projectId) {
      await pool.query('DELETE FROM drawing_register WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_mep_checklists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should register a new layout drawing with layout_type', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber: 'ELEC-101',
        revisionCode: 'R0',
        title: 'Electrical Point Layout',
        status: 'issued_for_approval',
        issuedDate: '2026-06-29',
        layoutType: 'electrical'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.layout_type).toBe('electrical');
    expect(res.body.data.client_status).toBe('pending');
    expect(res.body.data.contractor_status).toBe('pending');
    drawingId = res.body.data.id;
  });

  it('should block transition to issued_for_construction if approvals are missing', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/drawing-register/${drawingId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'issued_for_construction'
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('APPROVAL_REQUIRED');
  });

  it('should allow approving the drawing on behalf of the client', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register/${drawingId}/client-approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        notes: 'Client reviewed points and confirmed island placement'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_status).toBe('approved');
    expect(res.body.data.client_notes).toBe('Client reviewed points and confirmed island placement');
  });

  it('should allow approving the drawing by the contractor', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register/${drawingId}/contractor-approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        notes: 'Conduits checked against partition walls'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contractor_status).toBe('approved');
  });

  it('should now allow transition to issued_for_construction', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/drawing-register/${drawingId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'issued_for_construction'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('issued_for_construction');
  });

  it('should automatically seed and list MEP coordination checklist items', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/mep-checklist`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    
    const coordinationItem = res.body.data.find(item => item.item_name.includes('ceiling'));
    expect(coordinationItem).toBeDefined();
    mepChecklistItemId = coordinationItem.id;
  });

  it('should allow updating an MEP checklist item status and notes', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/mep-checklist/${mepChecklistItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'approved',
        notes: 'Ceiling heights coordinated with HVAC ducts'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.notes).toBe('Ceiling heights coordinated with HVAC ducts');
    expect(res.body.data.approved_by).toBeDefined();
  });
});
