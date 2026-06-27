const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Project Punch Lists & Walkthroughs API', () => {
  let accessToken;
  let portalToken = 'test-punch-portal-token-999';
  let tenantId;
  let projectId;
  let punchListId;
  let itemId;

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
       VALUES ($1, 'Test Punch List Project', 'Test Client', '9999999999', 'test@client.com', 'active', 600000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Punch Client', '9998887776', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM punch_list_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM punch_lists WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('starts with an empty punch lists list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/punch-lists`)
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('creates a new punch list in draft status', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/punch-lists`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Initial Handover Walkthrough',
        walkthrough_date: '2026-07-01'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe('Initial Handover Walkthrough');
    expect(res.body.data.status).toBe('draft');

    punchListId = res.body.data.id;
  });

  it('adds a punch list item, auto-activating the punch list status', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/punch-lists/${punchListId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        room_name: 'Living Room',
        trade: 'carpentry',
        item_description: 'TV unit panel laminate peeling at bottom corner'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.room_name).toBe('Living Room');
    expect(res.body.data.status).toBe('open');

    itemId = res.body.data.id;

    // Check parent status
    const plRes = await request(app)
      .get(`/api/projects/${projectId}/punch-lists/${punchListId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(plRes.body.data.status).toBe('active');
  });

  it('requires QC notes to resolve/close a punch list item', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/punch-lists/${punchListId}/items/${itemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'resolved'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('QC_NOTES_REQUIRED');
  });

  it('resolves/closes a punch list item once QC notes are provided', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/punch-lists/${punchListId}/items/${itemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'resolved',
        qc_notes: 'Re-pasted laminate using premium adhesive and clamped overnight. Sticking firmly now.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.qc_notes).toBe('Re-pasted laminate using premium adhesive and clamped overnight. Sticking firmly now.');
    expect(res.body.data.closed_by_qc).toBeDefined();
  });

  it('allows portal client to verify items from client portal', async () => {
    const res = await request(app)
      .post(`/api/portal/punch-lists/items/${itemId}/verify`)
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('verified');
    expect(res.body.data.client_verified).toBe(true);
  });

  it('allows portal client to sign-off walkthrough after all items are verified', async () => {
    const res = await request(app)
      .post(`/api/portal/punch-lists/${punchListId}/sign-off`)
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('client_verified');
    expect(res.body.data.signed_off_by_client).toBe(true);
    expect(res.body.data.client_signed_off_at).toBeDefined();
  });
});
