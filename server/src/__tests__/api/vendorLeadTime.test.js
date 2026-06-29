const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Vendor Lead Time and Inspection Notification API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let purchaseRequestId;
  let purchaseOrderId;
  let deliveryId;
  let deliveryItemId;
  let vendorId;

  beforeAll(async () => {
    // 1. Login as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'Lead Time Test Project', 'LT Client', '5551112222', 'lt@client.com', 'active', 50000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // Create a project vendor
    const vendorRes = await pool.query(`
      INSERT INTO project_vendors (tenant_id, project_id, vendor_name, status)
      VALUES ($1, $2, 'Test Vendor Inc.', 'approved')
      RETURNING id
    `, [tenantId, projectId]);
    vendorId = vendorRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM notifications WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM material_delivery_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM material_deliveries WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_order_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_orders WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_request_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_requests WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM vendor_lead_times WHERE tenant_id = $1 AND vendor_id IS NULL AND material_category = $2', [tenantId, 'test-paint-cat']);
      await pool.query('DELETE FROM project_vendors WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  test('1. List lead times configurations', async () => {
    const res = await request(app)
      .get('/api/vendor-lead-times')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('2. Save and configure a specific lead time override', async () => {
    const res = await request(app)
      .post('/api/vendor-lead-times')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        materialCategory: 'test-paint-cat',
        leadTimeDays: 6,
        vendorId: null
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lead_time_days).toBe(6);
  });

  test('3. Dynamic Latest Order Date calculation in Purchase Requests', async () => {
    const prRes = await request(app)
      .post(`/api/projects/${projectId}/purchase-requests`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        requiredByDate: '2026-07-15T00:00:00.000Z',
        deliveryLocation: 'site',
        notes: 'Lead time offset test request',
        items: [
          {
            itemName: 'Eco Premium Emulsion Paint',
            quantity: 10,
            unit: 'Litres',
            unitPrice: 500,
            brand: 'AsianPaints',
            materialSpecifications: 'Royal Matt Finish Emulsion',
            materialCategory: 'test-paint-cat'
          }
        ]
      });

    expect(prRes.status).toBe(201);
    expect(prRes.body.success).toBe(true);
    purchaseRequestId = prRes.body.data.id;

    // Fetch details to trigger getPRItems calculation
    const getRes = await request(app)
      .get(`/api/projects/${projectId}/purchase-requests/${purchaseRequestId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.items.length).toBe(1);
    
    const item = getRes.body.data.items[0];
    expect(item.lead_time_days).toBe(6);
    
    // Check that latest order date is exactly 6 days before July 15 (July 9)
    const expectedOrderDate = new Date('2026-07-15T00:00:00.000Z');
    expectedOrderDate.setDate(expectedOrderDate.getDate() - 6);
    
    // Timezone safe date check: compare year, month, and day components
    const recdDate = new Date(item.latest_order_date);
    expect(recdDate.getFullYear()).toBe(expectedOrderDate.getFullYear());
    expect(recdDate.getMonth()).toBe(expectedOrderDate.getMonth());
    expect(recdDate.getDate()).toBe(expectedOrderDate.getDate());
  });

  test('4. Material rejection registers an in-app alert notification', async () => {
    // 1. Submit approval for PR
    await request(app)
      .put(`/api/projects/${projectId}/purchase-requests/${purchaseRequestId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved' });

    // 2. Convert to Purchase Order
    const poRes = await request(app)
      .post(`/api/projects/${projectId}/purchase-requests/${purchaseRequestId}/convert`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vendorId,
        paymentTerms: 'COD',
        deliveryAddress: 'Main St.'
      });
    expect(poRes.status).toBe(201);
    purchaseOrderId = poRes.body.data.id;

    // Confirm PO status
    await pool.query("UPDATE purchase_orders SET status = 'confirmed' WHERE id = $1", [purchaseOrderId]);

    // 3. Log a Material Delivery Receipt (GRN)
    const itemsRes = await pool.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [purchaseOrderId]);
    const poItemId = itemsRes.rows[0].id;

    const delRes = await request(app)
      .post(`/api/projects/${projectId}/material-deliveries`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        purchaseOrderId,
        actualReceiptDate: new Date(),
        items: [
          {
            poItemId,
            itemName: 'Eco Premium Emulsion Paint',
            quantityExpected: 10,
            quantityReceived: 10,
            isDamaged: false
          }
        ]
      });
    expect(delRes.status).toBe(201);
    deliveryId = delRes.body.data.id;
    
    // Fetch delivery item ID
    const delItemsRes = await pool.query('SELECT * FROM material_delivery_items WHERE material_delivery_id = $1', [deliveryId]);
    deliveryItemId = delItemsRes.rows[0].id;

    // 4. Record Incoming Inspection, rejecting 2 items due to damage
    const inspectRes = await request(app)
      .post(`/api/projects/${projectId}/material-deliveries/${deliveryId}/inspect`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        inspectionNotes: 'Logged leakage in 2 tins.',
        items: [
          {
            itemId: deliveryItemId,
            quantityReceived: 10,
            specificationConformanceStatus: 'non-conforming',
            specificationVarianceDetails: 'Paint container seal broken',
            inspectionStatus: 'rejected',
            rejectedQuantity: 2.00,
            rejectionReason: 'Damaged during unloading/transit'
          }
        ]
      });
    expect(inspectRes.status).toBe(200);

    // 5. Assert that an in-app notification is inserted for the PO creator
    const notifRes = await pool.query("SELECT * FROM notifications WHERE type = 'material_rejection' AND tenant_id = $1", [tenantId]);
    expect(notifRes.rows.length).toBeGreaterThan(0);
    expect(notifRes.rows[0].message).toContain('rejected during site inspection');
  });
});
