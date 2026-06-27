const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Material Incoming Inspection Record API', () => {
  let accessToken;
  let tenantId;
  let projectId;
  let vendorId;
  let poId;
  let poItemId;
  let deliveryId;
  let deliveryItemId;

  beforeAll(async () => {
    // 1. CRM admin login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create test project
    const projRes = await pool.query(
      `INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
       VALUES ($1, 'Inspection Test Project', 'Material Client', '9999999999', 'inspect@test.com', 'active', 400000)
       RETURNING id`,
      [tenantId]
    );
    projectId = projRes.rows[0].id;

    // 3. Create test vendor
    const vendorRes = await pool.query(
      `INSERT INTO project_vendors (tenant_id, project_id, vendor_name)
       VALUES ($1, $2, 'CenturyPly Supplier')
       RETURNING id`,
      [tenantId, projectId]
    );
    vendorId = vendorRes.rows[0].id;

    // 4. Create Purchase Order
    const poRes = await pool.query(
      `INSERT INTO purchase_orders (tenant_id, project_id, vendor_id, po_number, status, total_amount)
       VALUES ($1, $2, $3, 'PO-INSPECT-001', 'confirmed', 50000)
       RETURNING id`,
      [tenantId, projectId, vendorId]
    );
    poId = poRes.rows[0].id;

    // 5. Create Purchase Order Item
    const poItemRes = await pool.query(
      `INSERT INTO purchase_order_items (tenant_id, purchase_order_id, item_name, quantity, unit, unit_price, brand, material_specifications)
       VALUES ($1, $2, 'Century 18mm Marine Ply', 50.00, 'sheets', 1000.00, 'CenturyPly', 'IS 710 BWR Waterproof Plywood')
       RETURNING id`,
      [tenantId, poId]
    );
    poItemId = poItemRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM material_delivery_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM material_deliveries WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM purchase_order_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_vendors WHERE id = $1', [vendorId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  beforeEach(async () => {
    // Create a new fresh delivery receipt before each test
    const mdRes = await pool.query(
      `INSERT INTO material_deliveries (tenant_id, project_id, purchase_order_id, delivery_number, status, expected_delivery_date)
       VALUES ($1, $2, $3, 'DN-TEST-' || gen_random_uuid(), 'pending', NOW())
       RETURNING id`,
      [tenantId, projectId, poId]
    );
    deliveryId = mdRes.rows[0].id;

    const mdItemRes = await pool.query(
      `INSERT INTO material_delivery_items (tenant_id, material_delivery_id, po_item_id, item_name, quantity_expected, quantity_received)
       VALUES ($1, $2, $3, 'Century 18mm Marine Ply', 50.00, 0.00)
       RETURNING id`,
      [tenantId, deliveryId, poItemId]
    );
    deliveryItemId = mdItemRes.rows[0].id;
  });

  afterEach(async () => {
    // Clear delivery receipts after each test to keep DB clean
    await pool.query('DELETE FROM material_delivery_items WHERE material_delivery_id = $1', [deliveryId]);
    await pool.query('DELETE FROM material_deliveries WHERE id = $1', [deliveryId]);
  });

  it('updates material delivery status to inspected when conforming and accepted', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-deliveries/${deliveryId}/inspect`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        inspectionNotes: 'Branding and dimensions are conforming. No visual damage.',
        items: [
          {
            itemId: deliveryItemId,
            quantityReceived: 50.00,
            specificationConformanceStatus: 'conforming',
            specificationVarianceDetails: '',
            inspectionStatus: 'accepted',
            rejectedQuantity: 0.00,
            rejectionReason: ''
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('inspected');
    expect(res.body.data.vendor_notification_sent).toBe(false);

    // Verify PO item quantity_received is updated
    const poItemQuery = await pool.query('SELECT quantity_received FROM purchase_order_items WHERE id = $1', [poItemId]);
    expect(parseFloat(poItemQuery.rows[0].quantity_received)).toBe(50.00);
  });

  it('marks delivery rejected and triggers vendor notification when items are rejected', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/material-deliveries/${deliveryId}/inspect`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        inspectionNotes: '10 sheets are rejected due to extreme dampness and structural warping.',
        items: [
          {
            itemId: deliveryItemId,
            quantityReceived: 50.00,
            specificationConformanceStatus: 'non-conforming',
            specificationVarianceDetails: '10 sheets warped due to water exposure during shipping',
            inspectionStatus: 'rejected',
            rejectedQuantity: 10.00,
            rejectionReason: 'Warped and damp sheets'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.vendor_notification_sent).toBe(true);
    expect(res.body.data.vendor_notification_sent_at).toBeDefined();

    // Verify database flags match
    const mdQuery = await pool.query('SELECT status, vendor_notification_sent FROM material_deliveries WHERE id = $1', [deliveryId]);
    expect(mdQuery.rows[0].status).toBe('rejected');
    expect(mdQuery.rows[0].vendor_notification_sent).toBe(true);
  });
});
