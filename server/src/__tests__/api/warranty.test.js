process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Warranties API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let portalToken = 'test-warranty-portal-token-999';
  let tenantId;
  let projectId;
  let warrantyId;

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
       VALUES ($1, 'Test Warranty Project', 'Warranty Client', '9998881111', 'warranty@client.com', 'active', 600000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Warranty Client User', '9998881111', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should create a product warranty record successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/warranties`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productName: 'Kitchen Hob',
        serialNumber: 'HOB-8877-XX',
        brand: 'Faber',
        brandWarrantyMonths: 24,
        companyWarrantyMonths: 12,
        startDate: '2026-01-01',
        endDate: '2028-01-01',
        warrantyDocument: 'faber_hob_warranty_card_key',
        notes: 'Covers ignition electrical parts and burner replacements.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product_name).toBe('Kitchen Hob');
    expect(res.body.data.brand).toBe('Faber');
    expect(res.body.data.brand_warranty_months).toBe(24);
    
    warrantyId = res.body.data.id;
  });

  it('should list warranties for the project with eligibility status', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/warranties`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].product_name).toBe('Kitchen Hob');
    expect(res.body.data[0].eligibility_status).toBe('active');
  });

  it('client portal user should view project warranties', async () => {
    const res = await request(app)
      .get('/api/portal/warranties')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].product_name).toBe('Kitchen Hob');
    expect(res.body.data[0].eligibility_status).toBe('active');
  });

  it('should update the product warranty status to voided', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/warranties/${warrantyId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'voided',
        notes: 'Voided due to customer using third party modifications.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('voided');
    expect(res.body.data.notes).toContain('third party');
  });

  it('should show voided eligibility after update', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/warranties`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].eligibility_status).toBe('voided');
  });

  it('should delete a product warranty', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/warranties/${warrantyId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await pool.query('SELECT * FROM warranties WHERE id = $1', [warrantyId]);
    expect(checkRes.rows.length).toBe(0);
  });
});
