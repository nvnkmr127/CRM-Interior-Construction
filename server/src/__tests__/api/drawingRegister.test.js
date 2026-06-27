process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Drawing Register API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let drawingId1;
  let drawingId2;

  beforeAll(async () => {
    // 1. Log in to get access token for staff
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Drawing Register Test Project',
        client_name: 'Drawing Client',
        client_phone: '9999999999',
        client_email: 'drawing-client@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: '123 Test Street, Bangalore',
        payment_terms: 'Net 30'
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    // Clean up database
    if (projectId) {
      await pool.query('DELETE FROM drawing_register WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should register a new drawing revision', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber: 'ARCH-101',
        revisionCode: 'R0',
        title: 'Floor Plan Layout',
        status: 'issued_for_approval',
        issuedDate: '2026-06-27'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.drawing_number).toBe('ARCH-101');
    expect(res.body.data.revision_code).toBe('R0');
    expect(res.body.data.status).toBe('issued_for_approval');
    expect(res.body.data.is_superseded).toBe(false);
    drawingId1 = res.body.data.id;
  });

  it('should list drawing register entries', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(drawingId1);
  });

  it('should prevent registering the same revision code for the drawing number', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber: 'ARCH-101',
        revisionCode: 'R0',
        title: 'Floor Plan Layout Duplicate',
        status: 'issued_for_approval',
        issuedDate: '2026-06-27'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should automatically mark old revision as superseded when registering a new revision', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        drawingNumber: 'ARCH-101',
        revisionCode: 'R1',
        title: 'Floor Plan Layout Revised',
        status: 'issued_for_construction',
        issuedDate: '2026-06-28'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    drawingId2 = res.body.data.id;

    // Fetch the list of drawings and check if R0 is marked as superseded
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`);

    const r0 = listRes.body.data.find(d => d.id === drawingId1);
    const r1 = listRes.body.data.find(d => d.id === drawingId2);

    expect(r0.is_superseded).toBe(true);
    expect(r0.status).toBe('superseded');
    expect(r1.is_superseded).toBe(false);
    expect(r1.status).toBe('issued_for_construction');
  });

  it('should edit details of a drawing register entry', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/drawing-register/${drawingId2}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Floor Plan Layout Revised (Updated Title)'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Floor Plan Layout Revised (Updated Title)');
  });

  it('should restore latest revision as active when deleting the active revision', async () => {
    // Delete the active R1 revision
    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}/drawing-register/${drawingId2}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // R0 should have become active again (is_superseded = false, status = 'issued_for_approval')
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/drawing-register`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listRes.body.data.length).toBe(1);
    const r0 = listRes.body.data[0];
    expect(r0.id).toBe(drawingId1);
    expect(r0.is_superseded).toBe(false);
    expect(r0.status).toBe('issued_for_approval');
  });
});
