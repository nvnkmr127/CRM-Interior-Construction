process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Portal Quotations & BOQ API', () => {
  jest.setTimeout(20000);

  let adminToken;
  let clientToken = 'portal-boq-client-token-999';
  let tenantId;
  let projectId;
  let draftQuotationId;
  let sentQuotationId;
  let acceptedQuotationId;

  beforeAll(async () => {
    // 1. CRM Admin Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create Project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Portal BOQ Test Project', 'Portal Client', '9000888000', 'clientportal@test.com', 'active', 500000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Portal User
    const clientTokenHash = crypto.createHash('sha256').update(clientToken).digest('hex');
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Portal Client User', '9000888000', $3, NOW() + INTERVAL '1 day')`,
      [tenantId, projectId, clientTokenHash]
    );

    // 4. Create Draft Quotation (Version 1)
    const q1 = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, version, status, total_amount, change_reason)
       VALUES ($1, $2, 'QT-PORT-01', 1, 'draft', 10000, 'Initial draft')
       RETURNING id`,
      [tenantId, projectId]
    );
    draftQuotationId = q1.rows[0].id;

    const chandelierKey = 'a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d';
    const basketKey = 'f1e2d3c4-b5a6-4f8e-7d6c-5b4a3f2e1d0c';

    await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, room_or_area, item_name, quantity, unit_price, scope_type, item_key)
       VALUES ($1, $2, 'Living Room', 'Chandelier', 1, 10000, 'original', $3)`,
      [tenantId, draftQuotationId, chandelierKey]
    );

    // 5. Create Sent Quotation (Version 2)
    const q2 = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, version, status, total_amount, change_reason)
       VALUES ($1, $2, 'QT-PORT-02', 2, 'sent', 12000, 'Design modification')
       RETURNING id`,
      [tenantId, projectId]
    );
    sentQuotationId = q2.rows[0].id;

    await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, room_or_area, item_name, quantity, unit_price, scope_type, item_key)
       VALUES ($1, $2, 'Living Room', 'Chandelier Upgraded', 1, 12000, 'original', $3)`,
      [tenantId, sentQuotationId, chandelierKey]
    );

    // 6. Create Accepted Quotation (Version 3)
    const q3 = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, version, status, total_amount, change_reason)
       VALUES ($1, $2, 'QT-PORT-03', 3, 'accepted', 15000, 'Extra client addition')
       RETURNING id`,
      [tenantId, projectId]
    );
    acceptedQuotationId = q3.rows[0].id;

    await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, room_or_area, item_name, quantity, unit_price, scope_type, item_key)
       VALUES ($1, $2, 'Living Room', 'Chandelier Upgraded', 1, 12000, 'original', $3),
              ($1, $2, 'Kitchen', 'Modular Basket Extra', 1, 3000, 'addition', $4)`,
      [tenantId, acceptedQuotationId, chandelierKey, basketKey]
    );
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE project_id = $1)', [projectId]);
      await pool.query('DELETE FROM quotations WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should list only non-draft quotations for client portal', async () => {
    const res = await request(app)
      .get('/api/portal/quotations')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Versions 2 and 3 should be listed, version 1 (draft) should be excluded
    const versions = res.body.data.map(q => q.version);
    expect(versions).toContain(2);
    expect(versions).toContain(3);
    expect(versions).not.toContain(1);
  });

  it('should retrieve items for a non-draft quotation', async () => {
    const res = await request(app)
      .get(`/api/portal/quotations/${sentQuotationId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].item_name).toBe('Chandelier Upgraded');
  });

  it('should block retrieving draft quotations', async () => {
    const res = await request(app)
      .get(`/api/portal/quotations/${draftQuotationId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should generate version difference comparison between two non-draft versions', async () => {
    const res = await request(app)
      .get(`/api/portal/quotations/${sentQuotationId}/compare/${acceptedQuotationId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.diffs).toBeDefined();
    
    // Check diff item added: Modular Basket Extra
    const addedItem = res.body.data.diffs.find(d => d.type === 'added');
    expect(addedItem).toBeDefined();
    expect(addedItem.item_name).toBe('Modular Basket Extra');
  });

  it('should block comparison if base or target is a draft version', async () => {
    const res = await request(app)
      .get(`/api/portal/quotations/${draftQuotationId}/compare/${acceptedQuotationId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should reject a sent quotation revision', async () => {
    const res = await request(app)
      .post(`/api/portal/quotations/${sentQuotationId}/reject`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
  });

  it('should accept a sent quotation revision and digital sign-off signature', async () => {
    // Re-verify a second sent quotation to accept
    const newSentQ = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, version, status, total_amount, change_reason)
       VALUES ($1, $2, 'QT-PORT-04', 4, 'sent', 16000, 'Final modifications')
       RETURNING id`,
      [tenantId, projectId]
    );
    const newSentQId = newSentQ.rows[0].id;

    const res = await request(app)
      .post(`/api/portal/quotations/${newSentQId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ signature: 'Jane Portal Client' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('accepted');
  });
});
