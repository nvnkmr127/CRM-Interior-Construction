const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

jest.setTimeout(60000);

describe('Daily Site Reports (DSR) API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let userId;
  let reportId;

  beforeAll(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;

    // Create test project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'DSR Test Project',
        client_name: 'DSR Client',
        client_phone: '9876543210',
        client_email: 'dsr@test.com',
        contract_file_key: 'test_key_dsr',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should successfully submit a valid daily site report', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/daily-reports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportDate: new Date().toISOString().split('T')[0],
        workDone: 'Installed 5 sheets of MDF on kitchen cupboards. Commenced sanding.',
        manpower: [
          { trade: 'carpentry', count: 2 },
          { trade: 'painting', count: 1 }
        ],
        materials: [
          { material: 'MDF Boards', quantity: '5 sheets' },
          { material: 'Wood Glue', quantity: '2 cans' }
        ],
        issuesEncountered: 'Minor power outage for 30 minutes in afternoon.',
        photos: ['mock-s3-key-photo-1.jpg', 'mock-s3-key-photo-2.jpg']
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.work_done).toContain('MDF');
    expect(res.body.data.photos).toHaveLength(2);
    reportId = res.body.data.id;
  });

  it('should reject submission if workDone is missing', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/daily-reports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportDate: new Date().toISOString().split('T')[0],
        photos: ['photo-1.jpg']
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject submission if photos is empty (mandatory photos check)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/daily-reports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportDate: new Date().toISOString().split('T')[0],
        workDone: 'Tested without photos.',
        photos: [] // Empty
      });

    console.log('PHOTOS EMPTY RESPONSE:', JSON.stringify(res.body));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body.error)).toContain('photo');
  });

  it('should reject duplicate reports for the same date', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/daily-reports`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        reportDate: new Date().toISOString().split('T')[0],
        workDone: 'Second submission same date.',
        photos: ['photo-dup.jpg']
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_REPORT');
  });

  it('should fetch list of reports for the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/daily-reports`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(reportId);
    expect(res.body.data[0].submitted_by_name).toBe('Admin User');
  });

  it('should fetch single report details by ID', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/daily-reports/${reportId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.work_done).toContain('MDF');
  });
});
