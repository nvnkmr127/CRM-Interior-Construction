process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Client Portal Transparency & Long-Term Customer Relationships API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let tenantId;
  let projectId;
  let portalToken = 'dummy-portal-token-999';
  let portalUserId;
  let relationshipRecordId;
  let referralId;

  beforeAll(async () => {
    // Login superadmin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Clean up potentially existing records
    await pool.query("DELETE FROM projects WHERE name = 'Transparency Villa'");
  });

  afterAll(async () => {
    // Cleanup
    if (projectId) {
      await pool.query('DELETE FROM client_referrals WHERE referrer_project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_relationship_records WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should create a project and auto-create relationship record on status = completed', async () => {
    // 1. Create project
    const projectRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Transparency Villa',
        client_name: 'Transparency Cust',
        client_phone: '8887776666',
        client_email: 'transparency@cust.com',
        status: 'active',
        contract_file_key: 'transparency-contract-key',
        contract_file_name: 'transparency_contract.pdf',
        contract_file_size: 15000,
        contract_file_mime: 'application/pdf'
      });

    expect(projectRes.status).toBe(201);
    projectId = projectRes.body.data.id;

    // 2. Setup a dummy portal user for testing portal endpoints
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    const portalUserRes = await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Transparency Cust', '8887776666', $3, $4)
       RETURNING id`,
      [tenantId, projectId, portalTokenHash, expiry]
    );
    portalUserId = portalUserRes.rows[0].id;

    // Mock project closure checklist entries to satisfy completion gate if any
    await pool.query('DELETE FROM project_closure_checklists WHERE project_id = $1', [projectId]);
    await pool.query(
      `INSERT INTO project_closure_checklists (
         tenant_id, project_id, financial_clearance_completed, task_completion_completed,
         snag_closure_completed, document_archive_completed, warranty_activation_completed
       ) VALUES ($1, $2, TRUE, TRUE, TRUE, TRUE, TRUE)`,
      [tenantId, projectId]
    );

    // 3. Mark project completed
    const completeRes = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'completed'
      });

    expect(completeRes.status).toBe(200);

    // 4. Verify client relationship record exists
    const relRes = await pool.query(
      'SELECT id, referral_code FROM client_relationship_records WHERE project_id = $1',
      [projectId]
    );
    expect(relRes.rows.length).toBe(1);
    expect(relRes.rows[0].referral_code).toBeDefined();
    relationshipRecordId = relRes.rows[0].id;
  });

  it('should allow the client portal user to retrieve their relationship record', async () => {
    const res = await request(app)
      .get('/api/portal/project/relationship')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(relationshipRecordId);
    expect(res.body.data.referral_code).toBeDefined();
  });

  it('should allow client portal users to submit referrals', async () => {
    const res = await request(app)
      .post('/api/portal/project/referrals')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({
        refereeName: 'Bob Builder',
        refereePhone: '1112223333',
        refereeEmail: 'bob@builder.com',
        notes: 'Needs modular wardrobe installation.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.referee_name).toBe('Bob Builder');
    referralId = res.body.data.id;
  });

  it('should allow admin to list all client relationship records', async () => {
    const res = await request(app)
      .get('/api/projects/relationship-records')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const myRecord = res.body.data.find(rec => rec.id === relationshipRecordId);
    expect(myRecord).toBeDefined();
  });

  it('should allow admin to log relationship follow-ups', async () => {
    const res = await request(app)
      .post(`/api/projects/relationship-records/${relationshipRecordId}/followups`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Followed up via call. Customer is happy, checking next year for renovation.'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.followup_notes).toContain('renovation');
    expect(res.body.data.last_followup_date).toBeDefined();
  });

  it('should allow admin to fetch and update referrals', async () => {
    // 1. Fetch referrals
    const fetchRes = await request(app)
      .get('/api/projects/referrals')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.success).toBe(true);
    const myReferral = fetchRes.body.data.find(ref => ref.id === referralId);
    expect(myReferral).toBeDefined();

    // 2. Update referral
    const updateRes = await request(app)
      .patch(`/api/projects/referrals/${referralId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        referralStatus: 'converted',
        rewardStatus: 'paid',
        rewardAmount: 5000,
        notes: 'Lead successfully signed contract.'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.referral_status).toBe('converted');
    expect(updateRes.body.data.reward_status).toBe('paid');
    expect(parseFloat(updateRes.body.data.reward_amount)).toBe(5000);
  });
});
