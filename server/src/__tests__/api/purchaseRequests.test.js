const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Purchase Requests API', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let vendorId;
  let boqItemId;
  let prId;

  beforeAll(async () => {
    // 1. Log in as admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@demo.com', password: 'Admin@123', tenantSlug: 'demo' });
    accessToken = loginRes.body.data.accessToken;

    // Fetch tenant ID
    const tenantRes = await pool.query("SELECT id FROM tenants WHERE slug = 'demo'");
    tenantId = tenantRes.rows[0].id;

    // 2. Create project
    const projRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, status, contract_value)
      VALUES ($1, 'PR Test Project', 'PR Client', '5551112222', 'pr@client.com', 'active', 50000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create a quotation & BOQ item
    const quoteRes = await pool.query(`
      INSERT INTO quotations (tenant_id, project_id, quotation_number, status, subtotal, total_amount)
      VALUES ($1, $2, 'QT-TEST-001', 'accepted', 10000.00, 10000.00)
      RETURNING id
    `, [tenantId, projectId]);
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(`
      INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit, brand, material_specifications)
      VALUES ($1, $2, 'Premium Teak Plywood', 10, 1000.00, 'Nos', 'Greenply', '19mm Marine Grade')
      RETURNING id
    `, [tenantId, quotationId]);
    boqItemId = itemRes.rows[0].id;

    // 4. Create project vendor
    const vendorRes = await pool.query(`
      INSERT INTO project_vendors (tenant_id, project_id, vendor_name, scope_of_work, status)
      VALUES ($1, $2, 'Supreme Ply Distributors', 'Ply & board supply', 'approved')
      RETURNING id
    `, [tenantId, projectId]);
    vendorId = vendorRes.rows[0].id;
  });

  afterAll(async () => {
    if (projectId) {
      await pool.query('DELETE FROM purchase_order_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM purchase_request_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_requests WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_vendors WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM quotation_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM quotations WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  test('1. Create a draft Purchase Request linked to BOQ item', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/purchase-requests`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        requiredByDate: '2026-07-15T00:00:00.000Z',
        deliveryLocation: 'site',
        notes: 'Required for living room paneling work.',
        items: [
          {
            boqItemId,
            quantity: 5,
            unitPrice: 1000.00
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pr_number).toContain('PR-');
    expect(res.body.data.status).toBe('draft');
    expect(parseFloat(res.body.data.total_amount)).toBe(5000.00);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].item_name).toBe('Premium Teak Plywood');
    expect(res.body.data.items[0].brand).toBe('Greenply');
    
    prId = res.body.data.id;
  });

  test('2. Get project Purchase Requests list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/purchase-requests`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(prId);
  });

  test('3. Get Purchase Request detail by ID', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/purchase-requests/${prId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(prId);
    expect(res.body.data.items.length).toBe(1);
  });

  test('4. Submit Purchase Request for PM approval', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/purchase-requests/${prId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'pending_approval' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending_approval');
  });

  test('5. PM approves Purchase Request', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/purchase-requests/${prId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
  });

  test('6. Convert Approved Purchase Request to Purchase Order', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/purchase-requests/${prId}/convert`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ vendorId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.po_number).toContain('PO-');
    expect(res.body.data.vendor_id).toBe(vendorId);
    expect(parseFloat(res.body.data.total_amount)).toBe(5000.00);

    // Verify Purchase Request status is now 'ordered'
    const prCheck = await pool.query('SELECT status FROM purchase_requests WHERE id = $1', [prId]);
    expect(prCheck.rows[0].status).toBe('ordered');
  });
});
