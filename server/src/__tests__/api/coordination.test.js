const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Production-Site Coordination & Automated Delay Gate', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let userId;
  let projectId;

  beforeAll(async () => {
    await pool.query("UPDATE tenants SET config = '{}' WHERE slug = 'demo'");

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@demo.com',
        password: 'Admin@123',
        tenantSlug: 'demo'
      });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    userId = userRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM delay_notifications WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM production_order_items WHERE production_order_id IN (SELECT id FROM production_orders WHERE project_id = $1)', [projectId]);
      await pool.query('DELETE FROM production_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_bookings WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  it('should create an active project via booking confirmation', async () => {
    // 1. Create a project
    const createRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        client_name: 'Coordination Client',
        name: 'Coordination Project',
        contract_value: 600000,
        contract_file_key: 'demo/contract/doc.pdf',
        contract_file_name: 'doc.pdf',
        contract_file_size: 100000,
        contract_file_mime: 'application/pdf'
      });
    expect(createRes.status).toBe(201);
    projectId = createRes.body.data.id;

    // 1.5 Insert approved contract document for booking confirmation
    await pool.query(
      `INSERT INTO documents (tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, status)
       VALUES ($1, $2, 'contract.pdf', 'contract', 1, 'demo/contract/doc.pdf', 100000, 'application/pdf', 'approved')`,
      [tenantId, projectId]
    );

    // 2. Confirm booking to make it active
    const bookRes = await request(app)
      .post(`/api/projects/${projectId}/booking`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        advance_amount: 60000,
        payment_method: 'bank_transfer',
        agreed_scope_summary: 'Full interior work.',
        design_freeze_target_date: '2026-07-01',
        project_start_date: '2026-07-05',
        assigned_designer_id: userId
      });
    expect(bookRes.status).toBe(200);
  });

  it('should return pending_setup for project coordination status by default', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/coordination`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alertType).toBe('pending_setup');
    expect(res.body.data.siteReadinessDate).toBeNull();
    expect(res.body.data.factoryReadinessDate).toBeNull();
  });

  it('should update site_readiness_date on the project and verify state', async () => {
    const patchRes = await request(app)
      .patch(`/api/projects/${projectId}/coordination`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        siteReadinessDate: '2026-07-10'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.siteReadinessDate).toContain('2026-07-10');
    expect(patchRes.body.data.alertType).toBe('pending_setup'); // still pending_setup because no production orders exist
  });

  it('should create a production order within 3-day buffer and verify aligned status', async () => {
    // Insert a scheduled production order manually in the database
    const orderRes = await pool.query(
      `INSERT INTO production_orders (tenant_id, project_id, order_number, status, factory_name, expected_completion_date)
       VALUES ($1, $2, 'PROD-COORD-1', 'scheduled', 'Main Factory', '2026-07-11 00:00:00')
       RETURNING *`,
      [tenantId, projectId]
    );
    expect(orderRes.rows.length).toBe(1);

    const checkRes = await request(app)
      .get(`/api/projects/${projectId}/coordination`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.alertType).toBe('aligned');
    expect(checkRes.body.data.divergenceDays).toBe(1); // 2026-07-11 is 1 day after 2026-07-10
  });

  it('should update the production order expected completion date and verify factory_delay alert and auto-delay notification', async () => {
    // 1. Fetch the order we inserted
    const poRes = await pool.query('SELECT id FROM production_orders WHERE project_id = $1 LIMIT 1', [projectId]);
    const poId = poRes.rows[0].id;

    // 2. Update expected completion date to be 10 days later via database or service
    const productionOrderService = require('../../services/projects/productionOrderService');
    await productionOrderService.updateProductionOrder(tenantId, projectId, poId, {
      expectedCompletionDate: '2026-07-20 00:00:00'
    });

    // 3. Fetch coordination status and verify alert
    const checkRes = await request(app)
      .get(`/api/projects/${projectId}/coordination`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.alertType).toBe('factory_delay');
    expect(checkRes.body.data.divergenceDays).toBe(10); // 2026-07-20 vs 2026-07-10

    // 4. Verify a draft delay notification was automatically created
    const notifRes = await pool.query(
      `SELECT * FROM delay_notifications WHERE project_id = $1 AND type = 'project_delay' AND status = 'draft'`,
      [projectId]
    );
    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].reason).toContain('Factory production completion date');
    expect(notifRes.rows[0].reason).toContain('delayed by 10 days');
  });

  it('should update project site readiness date to be later than factory completion date and verify site_delay alert', async () => {
    const patchRes = await request(app)
      .patch(`/api/projects/${projectId}/coordination`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        siteReadinessDate: '2026-07-30'
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.alertType).toBe('site_delay');
    expect(patchRes.body.data.divergenceDays).toBe(10); // 2026-07-30 is 10 days after 2026-07-20
  });

  it('should fetch the global coordination dashboard and verify this project is listed with correct properties', async () => {
    const dashboardRes = await request(app)
      .get('/api/projects/coordination/dashboard')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.body.success).toBe(true);

    const projectData = dashboardRes.body.data.find(p => p.projectId === projectId);
    expect(projectData).toBeDefined();
    expect(projectData.projectName).toBe('Coordination Project');
    expect(projectData.alertType).toBe('site_delay');
    expect(projectData.divergenceDays).toBe(10);
    expect(projectData.activeOrdersCount).toBe(1);
  });
});
