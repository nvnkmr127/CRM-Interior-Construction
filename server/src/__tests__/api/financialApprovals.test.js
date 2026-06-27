process.env.STORAGE_PROVIDER = 'local';
const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Financial Approvals & Permissions API', () => {
  jest.setTimeout(30000);
  let adminToken;
  let pmToken;
  let financeToken;
  let tenantId;
  let projectId;
  let milestoneId;
  let pmUserId;
  let financeUserId;
  let pmRoleId;
  let financeRoleId;

  beforeAll(async () => {
    // 1. Log in as admin to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    adminToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Set configuration thresholds for testing
    await pool.query(
      `UPDATE tenants 
       SET config = JSONB_SET(
         JSONB_SET(
           JSONB_SET(
             JSONB_SET(COALESCE(config::jsonb, '{}'::jsonb), '{finance_invoice_threshold}', '5000'),
             '{finance_payment_threshold}', '10000'
           ),
           '{finance_discount_threshold}', '2000'
         ),
         '{finance_credit_threshold}', '3000'
       )::text
       WHERE id = $1`,
      [tenantId]
    );

    // 2. Create custom role 'test_pm' with only project permissions
    const pmRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) VALUES ($1, 'test_pm', '["projects:read", "projects:update", "projects:manage"]') RETURNING id`,
      [tenantId]
    );
    pmRoleId = pmRoleRes.rows[0].id;

    // 3. Create custom role 'test_finance' with finance permissions
    const finRoleRes = await pool.query(
      `INSERT INTO roles (tenant_id, name, permissions) 
       VALUES ($1, 'test_finance', '["projects:read", "projects:update", "finance:invoices", "finance:payments", "finance:discounts", "finance:credits"]') 
       RETURNING id`,
      [tenantId]
    );
    financeRoleId = finRoleRes.rows[0].id;

    // 4. Create custom users
    const pmUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test PM', 'testpm@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') 
       RETURNING id`,
      [tenantId, pmRoleId]
    );
    pmUserId = pmUserRes.rows[0].id;

    const finUserRes = await pool.query(
      `INSERT INTO users (tenant_id, role_id, name, email, password_hash) 
       VALUES ($1, $2, 'Test Finance', 'testfinance@demo.com', '$2b$12$Tn2032FMfBMmDXri2QeWbe76h2i/.JjClq0DEe74IkyFBDSkT6Mqm') 
       RETURNING id`,
      [tenantId, financeRoleId]
    );
    financeUserId = finUserRes.rows[0].id;

    // Log in as both users to get tokens
    const pmLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testpm@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    pmToken = pmLogin.body.data.accessToken;

    const finLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'testfinance@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    financeToken = finLogin.body.data.accessToken;

    // 5. Create a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Finance Test Project',
        client_name: 'Finance Client',
        client_phone: '8888888888',
        client_email: 'finance-client@test.com',
        contract_file_key: 'test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf',
        site_address: '456 Test Street, Bangalore',
        payment_terms: 'Net 15'
      });
    projectId = projRes.body.data.id;

    // 6. Create a payment milestone
    const msRes = await request(app)
      .post('/api/payment-milestones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        name: 'Milestone 1',
        amount: 8000.00,
        percent: 10.00,
        dueDate: '2026-09-30'
      });
    milestoneId = msRes.body.data.id;
  });

  afterAll(async () => {
    // Cleanup
    if (milestoneId) {
      await pool.query('DELETE FROM financial_approvals WHERE target_id = $1 OR target_id IN (SELECT id FROM invoices WHERE payment_milestone_id = $1)', [milestoneId]);
      await pool.query('DELETE FROM invoices WHERE payment_milestone_id = $1', [milestoneId]);
      await pool.query('DELETE FROM payment_milestones WHERE id = $1', [milestoneId]);
    }
    if (projectId) {
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    if (pmUserId) await pool.query('DELETE FROM users WHERE id = $1', [pmUserId]);
    if (financeUserId) await pool.query('DELETE FROM users WHERE id = $1', [financeUserId]);
    if (pmRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [pmRoleId]);
    if (financeRoleId) await pool.query('DELETE FROM roles WHERE id = $1', [financeRoleId]);

    // Restore tenant config to default empty json
    await pool.query("UPDATE tenants SET config = '{}' WHERE id = $1", [tenantId]);
    await pool.end();
  });

  describe('Permission Checks', () => {
    it('should block a PM without finance:invoices permission from generating invoices', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${pmToken}`)
        .send({
          milestoneId,
          companyName: 'ACME'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
    });

    it('should allow finance user with finance:invoices permission to generate invoices', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${financeToken}`)
        .send({
          milestoneId,
          companyName: 'ACME'
        });

      // Amount is 8000, which is above the 5000 threshold.
      // So invoice creation succeeds (201) but status should be pending_approval.
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending_approval');
    });
  });

  describe('Approvals Workflow', () => {
    let pendingApprovalId;

    it('should list the pending invoice approval in the approvals queue', async () => {
      const res = await request(app)
        .get('/api/financial-approvals')
        .set('Authorization', `Bearer ${financeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const pendingInvoice = res.body.data.find(a => a.transaction_type === 'invoice');
      expect(pendingInvoice).toBeDefined();
      expect(pendingInvoice.status).toBe('pending');
      pendingApprovalId = pendingInvoice.id;
    });

    it('should block PM from approving/rejecting the request', async () => {
      const res = await request(app)
        .post(`/api/financial-approvals/${pendingApprovalId}/approve`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow finance user to approve the request and update invoice/milestone status', async () => {
      const approveRes = await request(app)
        .post(`/api/financial-approvals/${pendingApprovalId}/approve`)
        .set('Authorization', `Bearer ${financeToken}`);

      expect(approveRes.status).toBe(200);

      // Verify invoice status changed to sent
      const invRes = await pool.query('SELECT status FROM invoices WHERE payment_milestone_id = $1', [milestoneId]);
      expect(invRes.rows[0].status).toBe('sent');

      // Verify payment milestone status is updated to invoice_raised
      const pmRes = await pool.query('SELECT status FROM payment_milestones WHERE id = $1', [milestoneId]);
      expect(pmRes.rows[0].status).toBe('invoice_raised');
    });
  });
});
