process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');
const crypto = require('crypto');

describe('Handover Portal API', () => {
  jest.setTimeout(20000);

  let accessToken;
  let portalToken = 'test-handover-portal-token-111';
  let tenantId;
  let projectId;
  let checklistId;
  let docItemId;
  let keyItemId;
  let milestoneId;

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
       VALUES ($1, 'Test Handover Project', 'Handover Client', '9998887776', 'handover@client.com', 'active', 800000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create Client Portal User
    const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');
    const expiry = new Date(Date.now() + 3600000).toISOString();
    await pool.query(
      `INSERT INTO client_portal_users (tenant_id, project_id, name, phone, portal_token_hash, portal_token_expires_at)
       VALUES ($1, $2, 'Handover Client User', '9998887776', $3, $4)`,
      [tenantId, projectId, portalTokenHash, expiry]
    );

    // 4. Create Handover Checklist
    const checklistRes = await pool.query(
      `INSERT INTO handover_checklists (tenant_id, project_id, status)
       VALUES ($1, $2, 'in_progress')
       RETURNING id`,
      [tenantId, projectId]
    );
    checklistId = checklistRes.rows[0].id;

    // 5. Add checklist items
    await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, is_checked)
       VALUES ($1, 'Living Room', 'TV Unit alignment', true),
              ($1, 'Kitchen', 'Modular cabinets smooth operation', true)`,
      [checklistId]
    );

    // 6. Add a product documentation checklist item
    const docItemRes = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, item_type, serial_number, warranty_expiry_date, has_manual, has_warranty_card, is_checked)
       VALUES ($1, 'Product Documentation', 'Chimney Manual & Warranty', 'document', 'SN-CHIM-99', '2027-12-31', true, true, true)
       RETURNING id`,
      [checklistId]
    );
    docItemId = docItemRes.rows[0].id;

    // 7. Seed an unpaid payment milestone
    const msRes = await pool.query(
      `INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, status, is_deferred)
       VALUES ($1, $2, 'Final Handover Installment', 100000, 12.5, 'invoice_raised', false)
       RETURNING id`,
      [tenantId, projectId]
    );
    milestoneId = msRes.rows[0].id;

    // 8. Add a key handover checklist item
    const keyItemRes = await pool.query(
      `INSERT INTO handover_items (checklist_id, room, description, item_type, key_details, is_checked)
       VALUES ($1, 'Keys & Access Handovers', 'Main Door Keys', 'key_access', '3 physical keys', true)
       RETURNING id`,
      [checklistId]
    );
    keyItemId = keyItemRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM client_portal_users WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM handover_items WHERE checklist_id = $1', [checklistId]);
      await pool.query('DELETE FROM handover_checklists WHERE id = $1', [checklistId]);
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM payment_milestones WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('client should fetch their handover checklist and items', async () => {
    const res = await request(app)
      .get('/api/portal/handover')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.items).toHaveLength(4);
    expect(res.body.data.hasOutstandingPayments).toBe(true);
  });

  it('staff should update key details for access handovers', async () => {
    const res = await request(app)
      .patch(`/api/handover/items/${keyItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        checklistId,
        key_details: '3 physical keys handed over',
        is_checked: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.key_details).toBe('3 physical keys handed over');
  });

  it('staff should update a document item with warranty details', async () => {
    const res = await request(app)
      .patch(`/api/handover/items/${docItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        checklistId,
        serial_number: 'SN-CHIM-99-UPDATED',
        warranty_expiry_date: '2028-06-30',
        has_manual: false,
        has_warranty_card: true,
        is_checked: true
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.serial_number).toBe('SN-CHIM-99-UPDATED');
    expect(res.body.data.has_manual).toBe(false);
    expect(res.body.data.has_warranty_card).toBe(true);
  });

  it('client sign-off should fail when outstanding payments exist', async () => {
    const testOtp = '654321';
    const hash = crypto.createHash('sha256').update(testOtp).digest('hex');
    await pool.query(
      `UPDATE client_portal_users 
       SET otp_hash = $1, otp_expires_at = NOW() + INTERVAL '10 minutes'
       WHERE project_id = $2`,
      [hash, projectId]
    );

    const res = await request(app)
      .post('/api/portal/handover/sign-off')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ otp: testOtp });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Financial Clearance Pending');
  });

  it('staff should formally defer the payment milestone', async () => {
    const res = await request(app)
      .patch(`/api/payment-milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        is_deferred: true,
        deferral_reference: 'DEF-AUTH-999'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_deferred).toBe(true);
    expect(res.body.data.deferral_reference).toBe('DEF-AUTH-999');
  });

  it('client should be able to request sign-off OTP', async () => {
    const res = await request(app)
      .post('/api/portal/handover/send-otp')
      .set('Authorization', `Bearer ${portalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('client should sign off the handover using verified OTP after payment is deferred', async () => {
    const testOtp = '654321';
    const hash = crypto.createHash('sha256').update(testOtp).digest('hex');
    await pool.query(
      `UPDATE client_portal_users 
       SET otp_hash = $1, otp_expires_at = NOW() + INTERVAL '10 minutes'
       WHERE project_id = $2`,
      [hash, projectId]
    );

    const res = await request(app)
      .post('/api/portal/handover/sign-off')
      .set('Authorization', `Bearer ${portalToken}`)
      .send({ otp: testOtp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('signed_off');
    expect(res.body.data.client_otp_verified).toBe(true);
  });
});
