const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Vendor Performance Analytics API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let vendorId;
  let poId;
  let deliveryId;
  let milestoneId;
  let retroId;
  let retroVendorId;

  beforeAll(async () => {
    // 1. Log in as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project via SQL
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'Vendor Performance Project', 'Vendor Client', '5555555555', 'vendor@client.com', 'active', 100000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create project vendor
    const vendorRes = await pool.query(`
      INSERT INTO project_vendors (tenant_id, project_id, vendor_name, scope_of_work, status)
      VALUES ($1, $2, 'Top Quality Woodworks', 'Carpentry & Veneer supply', 'approved')
      RETURNING id
    `, [tenantId, projectId]);
    vendorId = vendorRes.rows[0].id;

    // 4. Create purchase order
    const poRes = await pool.query(`
      INSERT INTO purchase_orders (tenant_id, project_id, vendor_id, po_number, status, total_amount, expected_delivery_date)
      VALUES ($1, $2, $3, 'PO-TEST-001', 'received', 50000.00, NOW() - INTERVAL '1 day')
      RETURNING id
    `, [tenantId, projectId, vendorId]);
    poId = poRes.rows[0].id;

    // 5. Create material delivery (On-time: actual_receipt_date = expected_delivery_date)
    const deliveryRes = await pool.query(`
      INSERT INTO material_deliveries (tenant_id, project_id, purchase_order_id, delivery_number, status, expected_delivery_date, actual_receipt_date)
      VALUES ($1, $2, $3, 'DN-TEST-001', 'inspected', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
      RETURNING id
    `, [tenantId, projectId, poId]);
    deliveryId = deliveryRes.rows[0].id;

    // 6. Create material delivery items with defects (100 received, 5 rejected -> 5% defect rate)
    await pool.query(`
      INSERT INTO material_delivery_items (tenant_id, material_delivery_id, item_name, quantity_expected, quantity_received, rejected_quantity, specification_conformance_status, inspection_status)
      VALUES ($1, $2, 'Oak Veneer Sheets', 100, 100, 5, 'non-conforming', 'rejected')
    `, [tenantId, deliveryId]);

    // 7. Create payment milestone (Paid on-time)
    const milestoneRes = await pool.query(`
      INSERT INTO vendor_payment_milestones (tenant_id, project_id, vendor_id, purchase_order_id, name, amount, percentage, due_date, status, paid_amount, paid_at)
      VALUES ($1, $2, $3, $4, 'Delivery Milestone', 50000.00, 100, CURRENT_DATE - 2, 'paid', 50000.00, CURRENT_DATE - 2)
      RETURNING id
    `, [tenantId, projectId, vendorId, poId]);
    milestoneId = milestoneRes.rows[0].id;

    // 8. Create retrospective and rating
    const retroRes = await pool.query(`
      INSERT INTO project_retrospectives (tenant_id, project_id, what_went_well)
      VALUES ($1, $2, 'Vendor delivered great veneers.')
      RETURNING id
    `, [tenantId, projectId]);
    retroId = retroRes.rows[0].id;

    const retroVendorRes = await pool.query(`
      INSERT INTO project_retrospective_vendors (tenant_id, retrospective_id, project_vendor_id, rating, feedback)
      VALUES ($1, $2, $3, 4, 'Highly recommended wood veneer supplier.')
      RETURNING id
    `, [tenantId, retroId, vendorId]);
    retroVendorId = retroVendorRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM project_retrospective_vendors WHERE id = $1', [retroVendorId]);
      await pool.query('DELETE FROM project_retrospectives WHERE id = $1', [retroId]);
      await pool.query('DELETE FROM vendor_payment_milestones WHERE id = $1', [milestoneId]);
      await pool.query('DELETE FROM material_delivery_items WHERE material_delivery_id = $1', [deliveryId]);
      await pool.query('DELETE FROM material_deliveries WHERE id = $1', [deliveryId]);
      await pool.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);
      await pool.query('DELETE FROM project_vendors WHERE id = $1', [vendorId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    await pool.end();
  });

  it('should retrieve portfolio-wide vendor performance report', async () => {
    const res = await request(app)
      .get('/api/analytics/vendors')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const vendor = res.body.data.find(v => v.vendorName === 'Top Quality Woodworks');
    expect(vendor).toBeDefined();
    expect(vendor.poCount).toBe(1);
    expect(vendor.poTotalAmount).toBe(50000.00);
    expect(vendor.totalDeliveries).toBe(1);
    expect(vendor.onTimeRate).toBe(100.0); // actual <= expected
    expect(vendor.defectRate).toBe(5.0); // 5 / 100 * 100
    expect(vendor.avgRating).toBe(4.0);
    expect(vendor.ratingCount).toBe(1);
  });

  it('should retrieve detailed performance analytics for a specific vendor', async () => {
    const res = await request(app)
      .get(`/api/analytics/vendors/${encodeURIComponent('Top Quality Woodworks')}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    
    // Check summary details
    expect(data.summary.vendorName).toBe('Top Quality Woodworks');
    expect(data.summary.poCount).toBe(1);
    expect(data.summary.onTimeRate).toBe(100.0);
    expect(data.summary.defectRate).toBe(5.0);
    expect(data.summary.avgRating).toBe(4.0);

    // Check Purchase Orders
    expect(data.purchaseOrders.length).toBe(1);
    expect(data.purchaseOrders[0].po_number).toBe('PO-TEST-001');

    // Check Deliveries
    expect(data.deliveries.length).toBe(1);
    expect(data.deliveries[0].delivery_number).toBe('DN-TEST-001');
    expect(Number(data.deliveries[0].qty_received)).toBe(100);
    expect(Number(data.deliveries[0].qty_rejected)).toBe(5);

    // Check Payments
    expect(data.payments.length).toBe(1);
    expect(data.payments[0].name).toBe('Delivery Milestone');

    // Check Ratings
    expect(data.ratings.length).toBe(1);
    expect(data.ratings[0].rating).toBe(4);
    expect(data.ratings[0].feedback).toBe('Highly recommended wood veneer supplier.');
  });
});
