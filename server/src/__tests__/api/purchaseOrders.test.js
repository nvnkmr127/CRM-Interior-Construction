const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/pool');

describe('Purchase Orders API Ext', () => {
  jest.setTimeout(30000);
  let accessToken;
  let tenantId;
  let projectId;
  let vendorId;
  let boqItemId;
  let poId;

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
      INSERT INTO projects (tenant_id, name, client_name, client_phone, client_email, site_address, status, contract_value)
      VALUES ($1, 'PO Test Project', 'PO Client', '5552223333', 'po@client.com', '123 Site Address Rd', 'active', 60000)
      RETURNING id
    `, [tenantId]);
    projectId = projRes.rows[0].id;

    // 3. Create a quotation & BOQ item
    const quoteRes = await pool.query(`
      INSERT INTO quotations (tenant_id, project_id, quotation_number, status, subtotal, total_amount)
      VALUES ($1, $2, 'QT-PO-001', 'accepted', 12000.00, 12000.00)
      RETURNING id
    `, [tenantId, projectId]);
    const quotationId = quoteRes.rows[0].id;

    const itemRes = await pool.query(`
      INSERT INTO quotation_items (tenant_id, quotation_id, item_name, quantity, unit_price, unit, brand, material_specifications)
      VALUES ($1, $2, 'Premium Teak Plywood', 10, 1200.00, 'Nos', 'Greenply', '19mm Marine Grade')
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
      await pool.query('DELETE FROM documents WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM purchase_order_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM purchase_orders WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM project_vendors WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM quotation_items WHERE tenant_id = $1', [tenantId]);
      await pool.query('DELETE FROM quotations WHERE project_id = $1', [projectId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
  });

  test('1. Create PO and fallback delivery address to project site_address', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/purchase-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vendorId,
        expectedDeliveryDate: '2026-07-20T00:00:00.000Z',
        notes: 'Required urgently.',
        items: [
          {
            boqItemId,
            quantity: 5,
            unitPrice: 1200.00
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.delivery_address).toBe('123 Site Address Rd');
    
    poId = res.body.data.id;
  });

  test('2. Create PO with custom delivery address', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/purchase-orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        vendorId,
        expectedDeliveryDate: '2026-07-20T00:00:00.000Z',
        deliveryAddress: '456 Warehouse Blvd',
        notes: 'Direct to warehouse.',
        items: [
          {
            boqItemId,
            quantity: 5,
            unitPrice: 1200.00
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.delivery_address).toBe('456 Warehouse Blvd');
  });

  test('3. Update PO and trigger PDF generation on status = sent', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'sent' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('sent');

    // Verify document was created
    const docCheck = await pool.query(
      "SELECT * FROM documents WHERE project_id = $1 AND doc_type = 'contract' AND storage_key LIKE $2",
      [projectId, `%po/PO_%`]
    );
    expect(docCheck.rows.length).toBeGreaterThan(0);
    expect(docCheck.rows[0].mime_type).toBe('application/pdf');
  });
});
