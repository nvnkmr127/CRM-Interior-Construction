process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');
const amcService = require('../../services/postSale/amcService');

describe('AMCs API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let portalToken = 'test-amc-portal-token-999';
  let tenantId;
  let projectId;
  let amcId;
  let visitId;

  beforeAll(async () => {
    // 1. Login CRM admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Test AMC Project', 'AMC Client', '9998882222', 'amc@client.com', 'active', 700000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'AMC Client User', '9998882222', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM amc_visits WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM amcs WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should create an AMC contract with auto-generated visits successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/amcs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        contractNumber: 'AMC-2026-0001',
        contractValue: 45000.00,
        startDate: '2026-06-01',
        endDate: '2027-06-01',
        coveredScope: 'Annual plumbing, lighting fixture inspects, modular kitchen alignment repairs.',
        autoRenewalAlertDays: 30,
        generateVisits: true
      });

    amcId = res.body?.data?.id;
    visitId = res.body?.data?.visits?.[0]?.id;

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.contract_number).toBe('AMC-2026-0001');
    expect(parseFloat(res.body.data.contract_value)).toBe(45000.00);
    expect(res.body.data.visits.length).toBe(4); // 12 months / 3 = 4 quarterly visits
  });

  it('should list AMCs and their visits for the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/amcs`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].visits.length).toBe(4);
  });

  it('client portal user should view their active project AMCs & visits', async () => {
    const res = await request(app)
      .get('/api/portal/amcs')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].contract_number).toBe('AMC-2026-0001');
  });

  it('should update an AMC visit details', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/amcs/${amcId}/visits/${visitId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'completed',
        completedDate: '2026-09-05',
        remarks: 'First quarterly visit completed. Realigned kitchen drawers, checked plumbing seals.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.remarks).toContain('First quarterly visit');
  });

  it('should trigger checkAndNotifyExpiredOrExpiringAMCs without crash', async () => {
    // Manually run to confirm query syntaxes and logic
    await expect(amcService.checkAndNotifyExpiredOrExpiringAMCs()).resolves.not.toThrow();
  });

  it('should delete an AMC visit', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/amcs/${amcId}/visits/${visitId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await pool.query('SELECT * FROM amc_visits WHERE id = $1', [visitId]);
    expect(checkRes.rows.length).toBe(0);
  });
});
