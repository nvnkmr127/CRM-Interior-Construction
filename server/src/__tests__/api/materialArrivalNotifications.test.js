const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Material Arrival & Dispatch Notifications API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let pmUserId;
  let productionOrderId;
  let dispatchId;

  jest.setTimeout(30000);

  beforeAll(async () => {
    // 1. Login to get access token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // Fetch Admin User ID to set as PM
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'admin@demo.com'");
    pmUserId = userRes.rows[0].id;

    // 2. Create a test project with PM
    const projRes = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Logistics Test Project',
        client_name: 'Logistics Client',
        client_phone: '9998887777',
        client_email: 'logistics@client.com',
        contract_file_key: 'logistics_test_key',
        contract_file_name: 'contract.pdf',
        contract_file_size: 1024,
        contract_file_mime: 'application/pdf'
      });
    projectId = projRes.body.data.id;

    // Assign PM ID to the project
    await pool.query('UPDATE projects SET pm_id = $1 WHERE id = $2', [pmUserId, projectId]);

    // 3. Add an active Site Supervisor to the project site team
    await pool.query(`
      INSERT INTO project_site_team (tenant_id, project_id, role, name, phone, email, status)
      VALUES ($1, $2, 'supervisor', 'Supervisor Sam', '8888888888', 'supervisor_sam@test.com', 'active')
    `, [tenantId, projectId]);

    // 4. Create a dummy quotation/BOQ item for linking
    const quoteRes = await pool.query(
      `INSERT INTO quotations (tenant_id, project_id, quotation_number, status)
       VALUES ($1, $2, 'QUOTE-LOG-TEST', 'accepted') RETURNING id`,
      [tenantId, projectId]
    );
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(
      `INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit)
       VALUES ($1, $2, 'Modular TV Unit Panel', 2, 15000, 'Nos') RETURNING id`,
      [tenantId, quotationId]
    );
    const boqItemId = itemRes.rows[0].id;

    // 5. Create a Production Order
    const poRes = await request(app)
      .post(`/api/projects/${projectId}/production-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        factoryName: 'Logistics Modular Factory',
        expectedCompletionDate: new Date(Date.now() + 10 * 86400000).toISOString(),
        notes: 'Dispatch notifications test',
        items: [
          {
            boqItemId: boqItemId,
            quantity: 2,
            factoryAssignment: 'Logistics Modular Factory'
          }
        ]
      });
    productionOrderId = poRes.body.data.id;

    // 6. Force-set QC clearance to bypass the QC gate check
    await pool.query(
      `UPDATE production_orders SET is_cleared_for_dispatch = true WHERE id = $1`,
      [productionOrderId]
    );
  });

  afterAll(async () => {
    // Clean up created records (Note: notifications and audit_logs are immutable or cascade)
    if (projectId) {
      await pool.query('DELETE FROM project_site_team WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, tenantId]);
    }
    await pool.end();
  });

  it('should dispatch production order and notify PM and site supervisor', async () => {
    // 1. Dispatch the order
    const res = await request(app)
      .post(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vehicleNumber: 'KA-01-AB-1234',
        driverName: 'Driver Ramesh',
        driverContact: '9876543210',
        expectedDeliveryDate: new Date(Date.now() + 1 * 86400000).toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.dispatch_number).toBeDefined();
    dispatchId = res.body.data.id;

    // Give setImmediate a short delay to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify PM received in-app notification
    const notifRes = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'material_dispatch' ORDER BY created_at DESC LIMIT 1`,
      [pmUserId]
    );
    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].message).toContain('dispatched');
    expect(notifRes.rows[0].message).toContain(res.body.data.dispatch_number);
  });

  it('should confirm site delivery and notify PM and site supervisor', async () => {
    // 2. Confirm delivery
    const res = await request(app)
      .put(`/api/projects/${projectId}/production-orders/${productionOrderId}/dispatch/${dispatchId}/receipt`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        receivedByName: 'Supervisor Sam',
        receiptNotes: 'All panels received intact'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('delivered');

    // Give setImmediate a short delay to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify PM received in-app notification for delivery
    const notifRes = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 AND type = 'material_delivery' ORDER BY created_at DESC LIMIT 1`,
      [pmUserId]
    );
    expect(notifRes.rows.length).toBe(1);
    expect(notifRes.rows[0].message).toContain('arrived');
    expect(notifRes.rows[0].message).toContain(res.body.data.dispatch_number);
  });
});
