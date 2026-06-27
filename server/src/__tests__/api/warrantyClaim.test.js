process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Warranty Claims API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let portalToken = 'test-claim-portal-token-999';
  let tenantId;
  let projectId;
  let warrantyId;
  let claimId;

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
       VALUES ($1, 'Test Claims Project', 'Claims Client', '9998884444', 'claims@client.com', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Claims Client User', '9998884444', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );

    // 4. Create Warranty Record
    const wRes = await pool.query(
      `INSERT INTO warranties (tenant_id, project_id, product_name, serial_number, brand, start_date, end_date)
       VALUES ($1, $2, 'Modular Hinge', 'HG-55', 'Blum', '2026-01-01', '2027-01-01')
       RETURNING id`,
      [tenantId, projectId]
    );
    warrantyId = wRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM warranty_claims WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM warranties WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should allow staff to log a warranty claim successfully', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/warranty-claims`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        warrantyId,
        claimNumber: 'CLM-2026-STAFF-001',
        natureOfDefect: 'Cabinet door hinge loose, door sagging.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.claim_number).toBe('CLM-2026-STAFF-001');
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.eligibility_decision).toBe('pending');
  });

  it('should list warranty claims for the project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/warranty-claims`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].product_name).toBe('Modular Hinge');
    expect(res.body.data[0].brand).toBe('Blum');
  });

  it('should allow client portal users to submit a warranty claim', async () => {
    const res = await request(app)
      .post('/api/portal/warranty-claims')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        warrantyId,
        natureOfDefect: 'Kitchen hinge makes squeaking noise when closing.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('open');
    expect(res.body.data.claim_number).toContain('CLM-');

    claimId = res.body.data.id;
  });

  it('client portal user should view their submitted claims', async () => {
    const res = await request(app)
      .get('/api/portal/warranty-claims')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(1); // 1 staff claim + 1 portal claim
  });

  it('should allow staff to update claim decision, tech, and resolution details', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/warranty-claims/${claimId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        eligibilityDecision: 'approved',
        eligibilityReason: 'Covered under company interior alignment warranty.',
        status: 'resolved',
        resolutionDetails: 'Technician visited site, replaced hinge and oiled springs. Sagging hinge fixed.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.eligibility_decision).toBe('approved');
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.resolved_at).not.toBeNull();
  });

  it('should delete a claim successfully', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/warranty-claims/${claimId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await pool.query('SELECT * FROM warranty_claims WHERE id = $1', [claimId]);
    expect(checkRes.rows.length).toBe(0);
  });
});
